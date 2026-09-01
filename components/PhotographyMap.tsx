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

  const CHAR_W = 8.2;
  const LINE_H = 20;
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

  const inBounds = (r: Rect) =>
    r.x1 >= leftInset + MARGIN &&
    r.x2 <= W - MARGIN &&
    r.y1 >= MARGIN &&
    r.y2 <= H - MARGIN;
  const fits = (r: Rect) => inBounds(r) && !placed.some((q) => intersects(r, q));

  const candidatesFor = (
    x: number,
    y: number,
    w: number,
  ): Array<[Side, Rect]> => {
    const hh = LINE_H / 2;
    const right: Rect = { x1: x + LABEL_GAP, y1: y - hh, x2: x + LABEL_GAP + w, y2: y + hh };
    const left: Rect = { x1: x - LABEL_GAP - w, y1: y - hh, x2: x - LABEL_GAP, y2: y + hh };
    const bottom: Rect = { x1: x - w / 2, y1: y + LABEL_GAP, x2: x + w / 2, y2: y + LABEL_GAP + LINE_H };
    const top: Rect = { x1: x - w / 2, y1: y - LABEL_GAP - LINE_H, x2: x + w / 2, y2: y - LABEL_GAP };
    const preferRight = W - x >= x - leftInset;
    return [
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
  };

  const labelWidth = (p: Place) => Math.min(p.name.length * CHAR_W + 12, 240);

  for (const { p, x, y } of order) {
    for (const [side, rect] of candidatesFor(x, y, labelWidth(p))) {
      if (!fits(rect)) continue;
      layout.set(p.id, side);
      placed.push(rect);
      break;
    }
  }

  // Always show the hovered / selected place's label, even if it collided —
  // fall back to the best in-bounds side (or just the first one).
  if (activeId && !layout.has(activeId)) {
    const active = pins.find((pt) => pt.p.id === activeId);
    if (active) {
      const cands = candidatesFor(active.x, active.y, labelWidth(active.p));
      const [side, rect] = cands.find(([, r]) => inBounds(r)) ?? cands[0];
      layout.set(active.p.id, side);
      placed.push(rect);
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
  const [addOpen, setAddOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLDivElement>(null);

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
    if (!addOpen) return;
    const onDown = (e: PointerEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setAddOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [addOpen]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/places", {
          signal: controller.signal,
          cache: "no-store",
        });
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

  // Once the data lands and the loading overlay clears, nudge the map to
  // re-measure its container.
  useEffect(() => {
    if (status !== "ready") return;
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      mapRef.current?.resize();
    });
    return () => cancelAnimationFrame(id);
  }, [status]);

  // Pointer cursor while hovering a pin on the map.
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = hoverId ? "pointer" : "";
  }, [hoverId]);

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
      bearing: 0,
      pitch: 0,
      duration: 1000,
      essential: true,
    });
  }, []);

  // ---- Layers ---------------------------------------------------------
  const layers = useMemo(() => {
    const activeId = hoverId ?? selectedId;
    const layout = labelLayoutRef.current;
    const labelled = visible.filter((p) => layout.has(p.id));

    // Draw the hovered / selected place last so it sits on top of everything.
    const toTop = <T extends Place>(rows: T[]): T[] =>
      activeId
        ? [
            ...rows.filter((p) => p.id !== activeId),
            ...rows.filter((p) => p.id === activeId),
          ]
        : rows;
    const dotData = toTop(visible);
    const labelData = toTop(labelled);

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
        data: dotData,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        radiusMinPixels: 4,
        getPosition: (d) => [d.longitude, d.latitude],
        getRadius: (d) => (d.id === activeId ? 12 : 7),
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
        data: labelData,
        pickable: true,
        getPosition: (d) => [d.longitude, d.latitude],
        getText: (d) => d.name,
        getSize: (d) => (d.id === activeId ? 18 : 14),
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
          // Push the hovered / selected label a little further off its pin,
          // since that pin also grows on hover.
          const gap = d.id === activeId ? LABEL_GAP + 7 : LABEL_GAP;
          switch (layout.get(d.id)) {
            case "left":
              return [-gap, 0];
            case "top":
              return [0, -gap];
            case "bottom":
              return [0, gap];
            default:
              return [gap, 0];
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
          getPixelOffset: [labelVersion, activeId],
          getColor: mapMode,
          getSize: activeId,
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
      className={`app-shell ${lightUI ? "bg-[#e9e9e4]" : "bg-[#0a0c12]"}`}
    >
      <MapGL
        ref={mapRef}
        initialViewState={homeView()}
        mapStyle={MAP_STYLES[mapMode]}
        style={{ position: "absolute", inset: 0 }}
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
            className={lightUI ? "dcfc-popup dcfc-popup-light" : "dcfc-popup"}
            onClose={() => setSelectedId(null)}
          >
            <PopupCard
              place={selected}
              onClose={() => setSelectedId(null)}
              theme={lightUI ? "light" : "dark"}
            />
          </Popup>
        )}
      </MapGL>

      {/* Panel toggle — collapsed: hamburger + banner as one button */}
      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close panel"
          aria-expanded
          className={`absolute safe-left safe-top z-30 ${ctrlBtn}`}
          style={{ borderRadius: 5 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open panel"
          aria-expanded={false}
          className={`absolute safe-left safe-top z-30 flex h-10 items-center overflow-hidden pl-3 shadow-lg ring-1 backdrop-blur transition-colors ${
            lightUI
              ? "bg-white/90 text-zinc-800 ring-black/10 hover:bg-white"
              : "bg-zinc-800/80 text-zinc-100 ring-white/15 hover:bg-zinc-700"
          }`}
          style={{ borderRadius: 5 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ marginRight: 6 }}>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Banners_560.png"
            alt=""
            className="h-full w-32 object-cover"
            style={{ padding: 3, borderRadius: 6, marginLeft: 3 }}
          />
        </button>
      )}

      {sidebarOpen && (
        <Sidebar
          places={places}
          filtered={filtered}
          search={search}
          onSearch={setSearch}
          selectedId={selectedId}
          onSelect={handleSelect}
          onHoverPlace={setHoverId}
          status={status}
          errorMsg={errorMsg}
          theme={lightUI ? "light" : "dark"}
          hiddenGroups={hiddenGroups}
          onToggleGroup={toggleGroup}
        />
      )}

      {/* Map controls */}
      <div className="absolute safe-right safe-top z-20 flex flex-col items-end gap-2">
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
              className={`absolute right-full top-0 mr-2 w-36 overflow-hidden rounded-xl py-1 text-sm shadow-xl ring-1 backdrop-blur ${menuBox}`}
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

        <div ref={addRef} className="relative">
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            title="Suggest a place"
            aria-label="Suggest a place"
            aria-haspopup="dialog"
            aria-expanded={addOpen}
            className={ctrlBtn}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {addOpen && (
            <div
              role="dialog"
              aria-label="Suggest a place"
              className={`absolute right-full top-0 mr-2 w-64 max-w-[calc(100vw-4rem)] rounded-xl p-3 text-sm shadow-xl ring-1 backdrop-blur ${menuBox}`}
            >
              <p className={`font-semibold ${lightUI ? "text-zinc-900" : "text-white"}`}>
                Suggest a place
              </p>
              <p className={`mt-1 leading-snug ${lightUI ? "text-zinc-600" : "text-zinc-300"}`}>
                {'\nWant something added to the map?\n\n Email '}
                <a
                  href="mailto:dcfilmcollective@gmail.com"
                  className={`font-medium underline underline-offset-2 ${
                    lightUI
                      ? "text-blue-600 hover:text-blue-800"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  dcfilmcollective@gmail.com
                </a>{" "}
                or DM{" "}
                <a
                  href="https://www.instagram.com/dcfilmcollective"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium underline underline-offset-2 ${
                    lightUI
                      ? "text-blue-600 hover:text-blue-800"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  @dcfilmcollective
                </a>{" "}
                on Instagram.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Zoom */}
      <div
        className="absolute safe-right z-20 flex flex-col gap-2"
        style={{ bottom: 44 }}
      >
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
          className={`pointer-events-none absolute safe-bottom-sm safe-left z-10 rounded-md px-2.5 py-1 text-[11px] font-medium backdrop-blur ${badgeCls}`}
        >
          {visible.length} of {places.length} places
        </div>
      )}

      {status === "loading" && (
        <div
          className={`absolute inset-0 z-40 grid place-items-center backdrop-blur-sm ${
            lightUI ? "bg-[#e9e9e4]/85 text-zinc-700" : "bg-[#0a0c12]/85 text-zinc-200"
          }`}
        >
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <p className="text-sm font-medium">Loading places…</p>
            <p className="text-xs opacity-70">
              The first load can take a little while.
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute left-1/2 safe-top z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">
          Couldn’t load map data{errorMsg ? ` — ${errorMsg}` : ""}
        </div>
      )}
    </div>
  );
}
