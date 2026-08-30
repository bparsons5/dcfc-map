import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Forward geocoder used to place rows that have an `Address` but no
 * `Latitude`/`Longitude`. Uses OpenStreetMap Nominatim (no API key) and
 * caches successful results to a temp file so the (rate-limited) lookups
 * only ever run once per address for the lifetime of the machine.
 */

type Coord = [number, number]; // [longitude, latitude]

const CACHE_FILE = path.join(os.tmpdir(), "dcfc-map-geocache.json");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const CONTACT = "dcfc-map/1.0 (DMV photography map)";

let memory: Record<string, Coord | null> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function loadCache(): Promise<Record<string, Coord | null>> {
  if (memory) return memory;
  try {
    memory = JSON.parse(await fs.readFile(CACHE_FILE, "utf8"));
  } catch {
    memory = {};
  }
  return memory!;
}

function persist(): void {
  writeChain = writeChain
    .then(() => fs.writeFile(CACHE_FILE, JSON.stringify(memory)))
    .catch(() => {});
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drop suite / unit / apartment fragments that often defeat Nominatim. */
function simplify(address: string): string {
  return address
    .replace(/\s(?:#|ste\.?|suite|unit|apt\.?|bldg\.?|fl\.?|floor)\s*[\w-]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

async function lookup(q: string): Promise<Coord | null> {
  // Respect the Nominatim usage policy: max 1 request/second.
  await sleep(1100);
  try {
    const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": CONTACT, "Accept-Language": "en" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lon: string; lat: string }>;
    if (!Array.isArray(data) || !data[0]) return null;
    const lon = Number.parseFloat(data[0].lon);
    const lat = Number.parseFloat(data[0].lat);
    return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
  } catch {
    return null;
  }
}

export async function geocode(query: string): Promise<Coord | null> {
  const q = query.trim();
  if (!q) return null;

  const cache = await loadCache();
  if (q in cache && cache[q]) return cache[q];

  let result = await lookup(q);

  if (!result) {
    const simplified = simplify(q);
    if (simplified && simplified !== q) result = await lookup(simplified);
  }

  if (!result) {
    // Last resort: the trailing "City, ST 12345" (or "City, ST") portion,
    // which resolves to a town / ZIP centroid so the row still appears.
    const coarse = q.match(/[^,]+,\s*[A-Za-z]{2}(?:\s+\d{5})?\s*$/)?.[0]?.trim();
    if (coarse && coarse !== q) result = await lookup(coarse);
  }

  cache[q] = result;
  // Only persist successful hits — a transient failure should be retried
  // on the next run rather than cached permanently.
  if (result) persist();
  return result;
}
