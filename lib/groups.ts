import type { Place } from "./types";

export type RGBAColor = [number, number, number, number];

/**
 * Consistent colour per `Group` category. Keys are compared upper-cased.
 * Unknown groups get a stable colour from the fallback ramp.
 */
const PALETTE: Record<string, RGBAColor> = {
  COMMUNITY: [88, 130, 214, 255], // softened blue
  "LAB / CAMERA STORE": [255, 222, 61, 255], // #ffde3d
  "PHOTO STORE": [212, 98, 98, 255], // softened red
  STUDIO: [96, 174, 128, 255], // softened green
};

const FALLBACK: RGBAColor[] = [
  [196, 116, 205, 255], // muted fuchsia
  [218, 112, 128, 255], // muted rose
  [224, 146, 90, 255], // muted orange
  [96, 176, 168, 255], // muted teal
  [146, 128, 214, 255], // muted violet
];

const assigned = new Map<string, RGBAColor>();

export function normalizeGroup(group: string): string {
  return group.trim().toUpperCase() || "OTHER";
}

export function groupColor(group: string): RGBAColor {
  const key = normalizeGroup(group);
  if (PALETTE[key]) return PALETTE[key];
  if (!assigned.has(key)) {
    assigned.set(key, FALLBACK[assigned.size % FALLBACK.length]);
  }
  return assigned.get(key)!;
}

export function groupColorCss(group: string, alpha = 1): string {
  const [r, g, b] = groupColor(group);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Group places by category, sorted alphabetically, each list sorted by name. */
export function groupPlaces(places: Place[]): Array<{ group: string; items: Place[] }> {
  const map = new Map<string, Place[]>();
  for (const p of places) {
    const arr = map.get(p.group) ?? [];
    arr.push(p);
    map.set(p.group, arr);
  }
  return [...map.entries()]
    .map(([group, items]) => ({
      group,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}
