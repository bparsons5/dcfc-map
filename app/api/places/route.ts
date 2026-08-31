import Papa from "papaparse";
import { NextResponse } from "next/server";
import { normalizeGroup } from "@/lib/groups";
import { SHEET_CSV_URL, type Place } from "@/lib/types";

// Always run on request so we can serve the in-memory cache / fresh sheet data.
export const dynamic = "force-dynamic";

interface SheetRow {
  Name?: string;
  Address?: string;
  Latitude?: string;
  Longitude?: string;
  Notes?: string;
  Group?: string;
  "Button Link"?: string;
  Tags?: string;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const FETCH_TIMEOUT_MS = 8000;
let cache: { at: number; places: Place[] } | null = null;

function toNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildPlaces(csv: string): Place[] {
  const parsed = Papa.parse<SheetRow>(csv, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const rows = parsed.data.filter((row) => (row.Name ?? "").trim().length > 0);
  const places: Place[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const longitude = toNumber(row.Longitude);
    const latitude = toNumber(row.Latitude);

    // The sheet is expected to always carry coordinates; skip any row missing them.
    if (longitude == null || latitude == null) continue;

    const name = (row.Name ?? "").trim();
    places.push({
      id: `${i}-${slug(name) || "place"}`,
      name,
      address: (row.Address ?? "").trim(),
      group: normalizeGroup(row.Group ?? ""),
      linkUrl: (row["Button Link"] ?? "").trim(),
      linkLabel: (row.Notes ?? "").trim(),
      tags: (row.Tags ?? "").trim(),
      longitude,
      latitude,
    });
  }

  return places;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.places, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  let csv: string;
  try {
    const res = await fetch(SHEET_CSV_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`sheet responded ${res.status}`);
    csv = await res.text();
  } catch (err) {
    // Fall back to a stale cache if we have one, otherwise surface the error.
    if (cache) return NextResponse.json(cache.places);
    return NextResponse.json(
      { error: `Unable to load the Google Sheet: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  try {
    const places = buildPlaces(csv);
    cache = { at: Date.now(), places };
    return NextResponse.json(places, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse sheet data: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
