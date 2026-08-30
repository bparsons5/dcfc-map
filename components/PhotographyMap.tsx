"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapGL,
  Popup,
  useControl,
  type MapRef,
} from "react-map-gl/maplibre";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";

import { groupColor } from "@/lib/groups";
import type { Place } from "@/lib/types";
import Sidebar from "./Sidebar";
import PopupCard from "./PopupCard";

const MAP_STYLES = {
  normal: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;
type MapMode = keyof typeof MAP_STYLES;
const MODE_ORDER: MapMode[] = ["normal", "light", "dark"];
const MODE_LABELS: Record<MapMode, string> = {
  normal: "Normal",
  light: "Light",
  dark: "Dark",
};

// Centred / zoomed so the whole DMV spread — Ashburn out to Baltimore — is visible.
const HOME_VIEW = { longitude: -77.2, latitude: 39.02, zoom: 8.3 };
// Narrow viewports need to sit a touch east and zoom out to keep everything in frame.
const HOME_VIEW_MOBILE = { longitude: -77.06, latitude: 39.02, zoom: 7.85 };

const isMobileViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 767px)").matches;

const homeView = () => (isMobileViewport() ? HOME_VIEW_MOBILE : HOME_VIEW);

/** Gap in px between a pin and its label. */
const LABEL_GAP = 12;

type Status = "loading" | "ready" | "error";
type Side = "left" | "right" | "top" | "bottom";

/** deck.gl layers rendered as a MapLibre control, camera kept in sync by the map. */
function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const intersects = (a: Rect, b: Rect) =>
  !(a.x2 <= b.x1 || a.x1 >= b.x2 || a.y2 <= b.y1 || a.y1 >= b.y2);

/**
 * Greedy screen-space label layout: for each visible pin, try to place its
 * label right / left / bottom / top (horizontal side first, picking whichever
 * has more room), skipping any position that collides with an already-placed
 * label or another pin. Returns the chosen side per place id; places with no
 * free position get no label.
 */
function computeLabelLayout(
  map: MapRef,
  places: Place[],
  activeId: string | null,
  leftInset: number,
): Map<string, Side> {
  const layout = new Map<string, Side>();
  const container = map.getContainer();
  const W = container.clientWidth;
  const H = container.clientHeight;
  if (!W || !H) return layout;

  const CHAR_W = 7;
  const LINE_H = 17;
  const MARGIN = 2;

  const pins = places
    .map((p) => {
      const s = map.project([p.longitude, p.latitude]);
      return { p, x: s.x, y: s.y };
    })
    .filter((pt) => pt.x >= leftInset && pt.x <= W && pt.y >= 0 && pt.y <= H);

  // Keep-out boxes around every visible pin dot so labels route around them.
  const placed: Rect[] = pins.map((pt) => ({
    x1: pt.x - 10,
    y1: pt.y - 10,
    x2: pt.x + 10,
    y2: pt.y + 10,
  }));

  const order = [...pins].sort((a, b) => {
    const ap = a.p.id === activeId ? 0 : 1;
    const bp = b.p.id === activeId ? 0 : 1;
    return ap - bp || a.y - b.y || a.x - b.x;
  });

  const fits = (r: Rect) =>
    r.x1 >= leftInset + MARGIN &&
    r.x2 <= W - MARGIN &&
    r.y1 >= MARGIN &&
    r.y2 <= H - MARGIN &&
    !placed.some((q) => intersects(r, q));

  for (const { p, x, y } of order) {
    const w = Math.min(p.name.length * CHAR_W + 12, 240);
    const hh = LINE_H / 2;

    const right: Rect = { x1: x + LABEL_GAP, y1: y - hh, x2: x + LABEL_GAP + w, y2: y + hh };
    const left: Rect = { x1: x - LABEL_GAP - w, y1: y - hh, x2: x - LABEL_GAP, y2: y + hh };
    const bottom: Rect = { x1: x - w / 2, y1: y + LABEL_GAP, x2: x + w / 2, y2: y + LABEL_GAP + LINE_H };
    const top: Rect = { x1: x - w / 2, y1: y - LABEL_GAP - LINE_H, x2: x + w / 2, y2: y - LABEL_GAP };

    const preferRight = W - x >= x - leftInset;
    const candidates: Array<[Side, Rect]> = [
      ...(preferRight
        ? ([
            ["right", right],
            ["left", left],
          ] as Array<[Side, Rect]>)
        : ([
            ["left", left],
            ["right", right],
          ] as Array<[Side, Rect]>)),
      ["bottom", bottom],
      ["top", top],
    ];

    for (const [side, rect] of candidates) {
      if (!fits(rect)) continue;
      layout.set(p.id, side);
      placed.push(rect);
      break;
    }
  }

  return layout;
}

export default function PhotographyMap() {
  const mapRef = useRef<MapRef>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !isMobileViewport());
  const [mapMode, setMapMode] = useState<MapMode>("dark");
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [modeMenuOpen]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/places", { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        if (!Array.isArray(data)) throw new Error("Unexpected response shape");
        setPlaces(data);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setErrorMsg((err as Error).message);
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) =>
      [p.name, p.address, p.group, p.tags, p.linkLabel]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [places, search]);

  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = useCallback((group: string) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  // What actually gets drawn on the map: search matches minus hidden groups.
  const visible = useMemo(
    () => filtered.filter((p) => !hiddenGroups.has(p.group)),
    [filtered, hiddenGroups],
  );

  const selected = useMemo(() => {
    const p = places.find((x) => x.id === selectedId) ?? null;
    return p && !hiddenGroups.has(p.group) ? p : null;
  }, [places, selectedId, hiddenGroups]);

  // ---- Label layout -------------------------------------------------------
  const labelLayoutRef = useRef<Map<string, Side>>(new Map());
  const [labelVersion, setLabelVersion] = useState(0);
  const rafRef = useRef(0);

  const recomputeLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const activeId = hoverId ?? selectedId;
    const leftInset = sidebarOpen ? 336 : 0;
    labelLayoutRef.current = computeLabelLayout(map, visible, activeId, leftInset);
    setLabelVersion((v) => v + 1);
  }, [visible, hoverId, selectedId, sidebarOpen]);

  const scheduleRecompute = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recomputeLabels);
  }, [recomputeLabels]);

  useEffect(() => {
    scheduleRecompute();
    return () => cancelAnimationFrame(rafRef.current);
  }, [scheduleRecompute]);

  // ---- Camera -----------------------------------------------------------
  const flyTo = useCallback((place: Place) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [place.longitude, place.latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 1100,
      essential: true,
    });
  }, []);

  const handleSelect = useCallback(
    (place: Place) => {
      setSelectedId(place.id);
      flyTo(place);
    },
    [flyTo],
  );

  const resetView = useCallback(() => {
    setSelectedId(null);
    const v = homeView();
    mapRef.current?.flyTo({
      center: [v.longitude, v.latitude],
      zoom: v.zoom,
      duration: 1000,
      essential: true,
    });
  }, []);

  // ---- Layers ---------------------------------------------------------
  const layers = useMemo(() => {
    const activeId = hoverId ?? selectedId;
    const layout = labelLayoutRef.current;
    const labelled = visible.filter((p) => layout.has(p.id));

    const darkBasemap = mapMode === "dark";
    const labelColor: [number, number, number, number] = darkBasemap
      ? [236, 238, 244, 255]
      : [17, 20, 26, 255];
    const labelHalo: [number, number, number, number] = darkBasemap
      ? [6, 8, 14, 235]
      : [255, 255, 255, 235];

    return [
      new ScatterplotLayer<Place>({
        id: "place-dots",
        data: visible,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        radiusMinPixels: 4,
        getPosition: (d) => [d.longitude, d.latitude],
        getRadius: (d) => (d.id === activeId ? 11 : 7),
        getFillColor: (d) => groupColor(d.group),
        getLineColor: darkBasemap ? [255, 255, 255, 255] : [17, 20, 26, 255],
        lineWidthUnits: "pixels",
        getLineWidth: (d) => (d.id === selectedId ? 3 : 1.5),
        onHover: (info: PickingInfo<Place>) => setHoverId(info.object?.id ?? null),
        onClick: (info: PickingInfo<Place>) => {
          if (info.object) {
            handleSelect(info.object);
            return true;
          }
        },
        updateTriggers: {
          getRadius: activeId,
          getLineWidth: selectedId,
        },
      }),
      new TextLayer<Place>({
        id: "place-labels",
        data: labelled,
        pickable: true,
        getPosition: (d) => [d.longitude, d.latitude],
        getText: (d) => d.name,
        getSize: 12,
        sizeUnits: "pixels",
        getTextAnchor: (d): "start" | "middle" | "end" => {
          const s = layout.get(d.id);
          return s === "left" ? "end" : s === "right" ? "start" : "middle";
        },
        getAlignmentBaseline: (d): "top" | "center" | "bottom" => {
          const s = layout.get(d.id);
          return s === "top" ? "bottom" : s === "bottom" ? "top" : "center";
        },
        getPixelOffset: (d): [number, number] => {
          switch (layout.get(d.id)) {
            case "left":
              return [-LABEL_GAP, 0];
            case "top":
              return [0, -LABEL_GAP];
            case "bottom":
              return [0, LABEL_GAP];
            default:
              return [LABEL_GAP, 0];
          }
        },
        getColor: labelColor,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontWeight: 700,
        fontSettings: { sdf: true, radius: 14, buffer: 4 },
        outlineWidth: 3,
        outlineColor: labelHalo,
        onClick: (info: PickingInfo<Place>) => {
          if (info.object) {
            handleSelect(info.object);
            return true;
          }
        },
        updateTriggers: {
          getTextAnchor: labelVersion,
          getAlignmentBaseline: labelVersion,
          getPixelOffset: labelVersion,
          getColor: mapMode,
        },
      }),
    ];
  }, [visible, hoverId, selectedId, handleSelect, labelVersion, mapMode]);

  // ---- Theme (follows the basemap) --------------------------------------
  const lightUI = mapMode !== "dark";
  const ctrlBtn =
    "grid h-10 w-10 place-items-center rounded-full shadow-lg ring-1 backdrop-blur transition-colors " +
    (lightUI
      ? "bg-white/90 text-zinc-800 ring-black/10 hover:bg-white"
      : "bg-zinc-800/80 text-zinc-100 ring-white/15 hover:bg-zinc-700");
  const menuBox = lightUI
    ? "bg-white/95 text-zinc-800 ring-black/10"
    : "bg-zinc-800/90 text-zinc-100 ring-white/15";
  const badgeCls = lightUI
    ? "bg-white/85 text-zinc-600 ring-1 ring-black/10"
    : "bg-black/55 text-white/80";

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden ${
        lightUI ? "bg-[#e9e9e4]" : "bg-[#0a0c12]"
      }`}
    >
      <MapGL
        ref={mapRef}
        initialViewState={homeView()}
        mapStyle={MAP_STYLES[mapMode]}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
        onLoad={scheduleRecompute}
        onMove={scheduleRecompute}
        onResize={scheduleRecompute}
        onError={(e) => console.error("[maplibre]", e.error?.message ?? e)}
      >
        <DeckOverlay
          layers={layers}
          getCursor={({ isDragging, isHovering }) =>
            isDragging ? "grabbing" : isHovering ? "pointer" : "grab"
          }
          onClick={(info) => {
            if (!info.object) setSelectedId(null);
          }}
        />

        {selected && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="bottom"
            offset={18}
            closeButton={false}
            closeOnClick={false}
            maxWidth="none"
            className="dcfc-popup"
            onClose={() => setSelectedId(null)}
          >
            <PopupCard place={selected} onClose={() => setSelectedId(null)} />
          </Popup>
        )}
      </MapGL>

      {/* Panel toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? "Close panel" : "Open panel"}
        aria-expanded={sidebarOpen}
        className={`absolute left-4 top-4 z-30 ${ctrlBtn}`}
      >
        {sidebarOpen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {sidebarOpen && (
        <Sidebar
          places={places}
          filtered={filtered}
          search={search}
          onSearch={setSearch}
          selectedId={selectedId}
          onSelect={handleSelect}
          status={status}
          errorMsg={errorMsg}
          theme={lightUI ? "light" : "dark"}
          hiddenGroups={hiddenGroups}
          onToggleGroup={toggleGroup}
        />
      )}

      {/* Map controls */}
      <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={resetView}
          title="Reset view"
          aria-label="Reset view"
          className={ctrlBtn}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
        </button>

        <div ref={modeMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setModeMenuOpen((o) => !o)}
            title="Map style"
            aria-label="Map style"
            aria-haspopup="menu"
            aria-expanded={modeMenuOpen}
            className={ctrlBtn}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 2 9 5-9 5-9-5 9-5Z" />
              <path d="m3 12 9 5 9-5" />
              <path d="m3 17 9 5 9-5" />
            </svg>
          </button>

          {modeMenuOpen && (
            <div
              role="menu"
              className={`absolute right-0 mt-2 w-36 overflow-hidden rounded-xl py-1 text-sm shadow-xl ring-1 backdrop-blur ${menuBox}`}
            >
              {MODE_ORDER.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mapMode === mode}
                  onClick={() => {
                    setMapMode(mode);
                    setModeMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors ${
                    lightUI ? "hover:bg-black/5" : "hover:bg-white/10"
                  } ${
                    mapMode === mode
                      ? "font-semibold " + (lightUI ? "text-zinc-900" : "text-white")
                      : lightUI
                        ? "text-zinc-600"
                        : "text-zinc-300"
                  }`}
                >
                  {MODE_LABELS[mode]}
                  {mapMode === mode && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m20 6-11 11-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zoom */}
      <div className="absolute bottom-8 right-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className={ctrlBtn}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className={ctrlBtn}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      {status === "ready" && (
        <div
          className={`pointer-events-none absolute bottom-3 left-4 z-10 rounded-md px-2.5 py-1 text-[11px] font-medium backdrop-blur ${badgeCls}`}
        >
          {visible.length} of {places.length} places
        </div>
      )}
    </div>
  );
}
