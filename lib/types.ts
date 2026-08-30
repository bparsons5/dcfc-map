export const SHEET_ID = "1TaIwUePUSt0V985D7Wy5JlaRwy6L5eXrkjzC9vA_Rf0";

/** Public CSV export of the "DB" tab. */
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=DB`;

/** Link to open the source spreadsheet. */
export const SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

export interface Place {
  /** Stable id derived from row index + name. */
  id: string;
  name: string;
  address: string;
  /** Normalised (upper-cased, trimmed) value of the `Group` column. */
  group: string;
  /** URL from the `Button Link` column (may be empty). */
  linkUrl: string;
  /** Display text for the link — the `Notes` column, e.g. `@handle` or a site name. */
  linkLabel: string;
  /** Raw `Tags` column, used for search only. */
  tags: string;
  longitude: number;
  latitude: number;
  /** true when the coordinates came from the geocoder rather than the sheet. */
  geocoded: boolean;
}
