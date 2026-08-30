"use client";

import type { Place } from "@/lib/types";

function googleMapsUrl(place: Place): string {
  if (place.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
}

export default function PopupCard({
  place,
  onClose,
  theme,
}: {
  place: Place;
  onClose: () => void;
  theme: "light" | "dark";
}) {
  const dark = theme === "dark";
  const c = {
    card: dark
      ? "bg-zinc-900/95 text-zinc-100 ring-white/10"
      : "bg-white text-zinc-900 ring-black/10",
    close: dark
      ? "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
      : "text-zinc-400 hover:bg-black/5 hover:text-zinc-700",
    title: dark ? "text-white" : "text-zinc-900",
    address: dark
      ? "text-zinc-400 decoration-zinc-600 hover:text-zinc-100 hover:decoration-zinc-400"
      : "text-zinc-600 decoration-zinc-300 hover:text-zinc-900 hover:decoration-zinc-500",
    link: dark
      ? "text-blue-400 hover:text-blue-300"
      : "text-blue-600 hover:text-blue-800",
    linkPlain: dark ? "text-zinc-400" : "text-zinc-500",
  };

  return (
    <div
      className={`relative w-[260px] rounded-2xl p-4 pr-8 shadow-xl ring-1 backdrop-blur ${c.card}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={`absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full transition-colors ${c.close}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <h3 className={`text-base font-bold leading-tight ${c.title}`}>
        {place.name}
      </h3>

      {place.address && (
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-1.5 block text-sm leading-snug underline underline-offset-2 ${c.address}`}
        >
          {place.address}
        </a>
      )}

      {place.linkLabel && (
        <div className="mt-3">
          {place.linkUrl ? (
            <a
              href={place.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-medium underline underline-offset-2 ${c.link}`}
            >
              {place.linkLabel}
            </a>
          ) : (
            <span className={`text-sm ${c.linkPlain}`}>{place.linkLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
