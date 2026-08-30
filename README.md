# DCFC Photographer Map

An interactive map of helpful places for photographers in the DMV (DC / Maryland / Virginia) — camera stores, labs, darkrooms, studios, galleries, and community groups.

![DCFC Photographer Map](public/DCFC%20Photographer%20Map.png)

## How it works

- **Data** is pulled live from a public Google Sheet (the **DB** tab) via its CSV export. A Next.js route handler (`app/api/places/route.ts`) fetches and parses it, and forward-geocodes any rows missing `Latitude` / `Longitude` (OpenStreetMap Nominatim, cached to a temp file).
- **Map** is rendered with [deck.gl](https://deck.gl) layers over a [MapLibre](https://maplibre.org) basemap ([react-map-gl](https://visgl.github.io/react-map-gl/)), using CARTO styles. Pins are colour-coded by `Group`, with a custom screen-space label layout that places each name left / right / above / below its pin and hides labels that would collide.
- **Sidebar** lists places grouped by category with collapsible sections, per-group show/hide toggles, and search. Clicking an entry flies the camera to that pin and opens its card.
- **Controls**: reset-to-home view, basemap style switcher (Normal / Light / Dark, which also themes the UI), and zoom. The panel collapses to a hamburger and defaults closed on mobile.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The first request to `/api/places` after a server start is slow (~10–30s) while missing coordinates are geocoded; results are cached, so subsequent loads are instant.

## Configuration

The sheet is referenced in `lib/types.ts`:

```ts
export const SHEET_ID = "1TaIwUePUSt0V985D7Wy5JlaRwy6L5eXrkjzC9vA_Rf0";
```

Expected columns on the **DB** tab: `Name`, `Address`, `Latitude`, `Longitude`, `Notes` (handle / link text), `Group`, `Button Link` (URL), `Tags`.

## Tech

Next.js (App Router) · React · TypeScript · Tailwind CSS · deck.gl · MapLibre GL · PapaParse
