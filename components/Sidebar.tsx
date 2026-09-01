"use client";

import { useEffect, useMemo, useState } from "react";
import { groupColorCss, groupPlaces } from "@/lib/groups";
import type { Place } from "@/lib/types";

interface SidebarProps {
  places: Place[];
  filtered: Place[];
  search: string;
  onSearch: (value: string) => void;
  selectedId: string | null;
  onSelect: (place: Place) => void;
  onHoverPlace: (id: string | null) => void;
  status: "loading" | "ready" | "error";
  errorMsg: string;
  theme: "light" | "dark";
  hiddenGroups: Set<string>;
  onToggleGroup: (group: string) => void;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {hidden ? (
        <>
          <path d="M2 12s3.8-6.5 10-6.5c2.1 0 3.9.7 5.4 1.6" />
          <path d="M22 12s-3.8 6.5-10 6.5c-2.1 0-3.9-.7-5.4-1.6" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="m3 3 18 18" />
        </>
      ) : (
        <>
          <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );
}

function FolderIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function Sidebar({
  places,
  filtered,
  search,
  onSearch,
  selectedId,
  onSelect,
  onHoverPlace,
  status,
  errorMsg,
  theme,
  hiddenGroups,
  onToggleGroup,
}: SidebarProps) {
  const groups = useMemo(() => groupPlaces(filtered), [filtered]);
  const allGroupNames = useMemo(
    () => groupPlaces(places).map((g) => g.group),
    [places],
  );

  // The banner is the DC Film Collective badge — link it to their profile.
  const bannerHref = useMemo(
    () =>
      places.find((p) => p.name.toLowerCase().includes("dc film collective"))
        ?.linkUrl || "",
    [places],
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searching = search.trim().length > 0;

  // Collapse state is keyed by group name; default (missing key) = expanded.
  useEffect(() => {
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const name of allGroupNames) {
        if (!(name in next)) next[name] = false;
      }
      return next;
    });
  }, [allGroupNames]);

  const dark = theme === "dark";
  const c = {
    panel: dark
      ? "bg-zinc-800/80 text-zinc-100 ring-white/10"
      : "bg-white/95 text-zinc-900 ring-black/10",
    title: dark ? "text-white" : "text-zinc-900",
    subtitle: dark ? "text-zinc-400" : "text-zinc-500",
    searchBox: dark
      ? "bg-white/10 ring-white/15 focus-within:ring-white/30"
      : "bg-white ring-black/10 focus-within:ring-black/20",
    searchInput: dark
      ? "text-zinc-100 placeholder:text-zinc-500"
      : "text-zinc-800 placeholder:text-zinc-400",
    muted: dark ? "text-zinc-400" : "text-zinc-500",
    folderHover: dark ? "hover:bg-white/10" : "hover:bg-black/5",
    folderName: dark ? "text-zinc-100" : "text-zinc-800",
    itemActive: dark
      ? "bg-white/15 font-semibold text-white"
      : "bg-black/10 font-semibold text-zinc-900",
    itemIdle: dark
      ? "text-zinc-300 hover:bg-white/10"
      : "text-zinc-700 hover:bg-black/5",
    dotRing: dark ? "ring-white/25" : "ring-black/10",
    errorBox: dark
      ? "bg-red-500/10 text-red-300 ring-red-500/30"
      : "bg-red-50 text-red-700 ring-red-200",
    eyeBtn: dark
      ? "text-zinc-500 hover:bg-white/10 hover:text-zinc-100"
      : "text-zinc-400 hover:bg-black/5 hover:text-zinc-700",
    tag: dark
      ? "bg-white/10 text-zinc-300"
      : "bg-black/5 text-zinc-600",
  };

  return (
    <aside
      className={`panel-maxh pointer-events-auto absolute safe-left safe-top-panel z-10 flex w-[19rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 backdrop-blur-md ${c.panel}`}
    >
      {/* Header */}
      <div className="px-3 pt-3">
        {bannerHref ? (
          <a
            href={bannerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-xl ring-1 ring-transparent transition hover:ring-black/10 hover:brightness-105"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Banners_560.png"
              alt="DC Film Collective"
              className="h-20 w-full object-cover"
            />
          </a>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/Banners_560.png"
            alt=""
            className="h-20 w-full rounded-xl object-cover"
          />
        )}
      </div>
      <div className="px-3 pt-3">
        <h1 className={`text-xl font-extrabold leading-tight ${c.title}`}>
          Photographer Map
        </h1>
      </div>
      <div className="px-3 pb-1 pt-0.5">
        <p className={`text-xs leading-snug ${c.subtitle}`}>
          A list of helpful places for photographers in the DMV
        </p>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${c.searchBox}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search..."
            className={`w-full bg-transparent text-sm outline-none ${c.searchInput}`}
          />
        </div>
      </div>

      {/* Group list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {status === "loading" && (
          <p className={`px-2 py-6 text-center text-sm ${c.muted}`}>
            Loading places…
          </p>
        )}

        {status === "error" && (
          <p className={`mx-1 my-3 rounded-lg px-3 py-2 text-xs ring-1 ${c.errorBox}`}>
            {errorMsg || "Something went wrong loading the map data."}
          </p>
        )}

        {status === "ready" && groups.length === 0 && (
          <p className={`px-2 py-6 text-center text-sm ${c.muted}`}>
            No places match “{search}”.
          </p>
        )}

        {groups.map(({ group, items }) => {
          const open = searching ? true : !collapsed[group];
          const color = groupColorCss(group);
          const groupHidden = hiddenGroups.has(group);
          return (
            <div key={group} className="py-1">
              <div
                className={`flex w-full items-center gap-1 rounded-lg pl-2 pr-1 ${c.folderHover}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))
                  }
                  className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left transition-opacity ${
                    groupHidden ? "opacity-40" : ""
                  }`}
                >
                  <FolderIcon color={color} />
                  <span className={`flex-1 truncate text-sm font-bold tracking-wide ${c.folderName}`}>
                    {group}
                  </span>
                  <span className={`text-xs font-medium ${c.muted}`}>
                    {items.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))
                  }
                  aria-label={open ? `Collapse ${group}` : `Expand ${group}`}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${c.eyeBtn}`}
                >
                  <Chevron open={open} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleGroup(group)}
                  aria-pressed={groupHidden}
                  aria-label={groupHidden ? `Show ${group}` : `Hide ${group}`}
                  title={groupHidden ? "Show group" : "Hide group"}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${c.eyeBtn}`}
                >
                  <EyeIcon hidden={groupHidden} />
                </button>
              </div>

              {open && (
                <ul className={`mb-1 mt-0.5 ${groupHidden ? "opacity-40" : ""}`}>
                  {items.map((place) => {
                    const active = place.id === selectedId;
                    return (
                      <li key={place.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(place)}
                          onMouseEnter={() => onHoverPlace(place.id)}
                          onMouseLeave={() => onHoverPlace(null)}
                          onFocus={() => onHoverPlace(place.id)}
                          onBlur={() => onHoverPlace(null)}
                          className={`flex w-full flex-col gap-1 rounded-lg py-1.5 pl-4 pr-2 text-left text-sm transition-colors ${
                            active ? c.itemActive : c.itemIdle
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ${c.dotRing}`}
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{place.name}</span>
                          </span>
                          {place.tagList.length > 0 && (
                            <span className="flex flex-wrap gap-1 pl-[1.25rem]">
                              {place.tagList.map((t) => (
                                <span
                                  key={t}
                                  className={`rounded px-1 py-[1px] text-[9px] font-medium uppercase tracking-wide ${c.tag}`}
                                >
                                  {t}
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
