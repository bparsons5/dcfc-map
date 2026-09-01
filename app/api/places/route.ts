import Papa from "papaparse";
import { NextResponse } from "next/server";
import { normalizeGroup } from "@/lib/groups";
import { SHEET_CSV_URL, type Place } from "@/lib/types";

// Always run on request; every call fetches the sheet fresh (no caching).
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

interface SheetRow {
  Name?: string;
  Address?: string;
  Latitude?: string;
  Longitude?: string;
  "Google Link"?: string;
  Notes?: string;
  Group?: string;
  "Button Link"?: string;
  Tags?: string;
  Description?: string;
}

const FETCH_TIMEOUT_MS = 8000;

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
    const tags = (row.Tags ?? "").trim();
    places.push({
      id: `${i}-${slug(name) || "place"}`,
      name,
      address: (row.Address ?? "").trim(),
      group: normalizeGroup(row.Group ?? ""),
      linkUrl: (row["Button Link"] ?? "").trim(),
      linkLabel: (row.Notes ?? "").trim(),
      googleLink: (row["Google Link"] ?? "").trim(),
      description: (row.Description ?? "").trim(),
      tags,
      tagList: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      longitude,
      latitude,
    });
  }

  return places;
}

export async function GET() {
  let csv: string;
  try {
    const res = await fetch(SHEET_CSV_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`sheet responded ${res.status}`);
    csv = await res.text();
  } catch (err) {
    return NextResponse.json(
      { error: `Unable to load the Google Sheet: ${(err as Error).message}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const places = buildPlaces(csv);
    return NextResponse.json(places, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse sheet data: ${(err as Error).message}` },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
