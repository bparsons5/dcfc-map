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
  /** URL from the `Google Link` column — used as the address hyperlink. */
  googleLink: string;
  /** Free-text `Description` column (may be empty). */
  description: string;
  /** Raw `Tags` column, used for search. */
  tags: string;
  /** `Tags` split on commas and trimmed. */
  tagList: string[];
  longitude: number;
  latitude: number;
}
