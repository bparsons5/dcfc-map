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
}: {
  place: Place;
  onClose: () => void;
}) {
  return (
    <div className="relative w-[260px] rounded-2xl bg-zinc-900/95 p-4 pr-8 text-zinc-100 shadow-xl ring-1 ring-white/10 backdrop-blur">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <h3 className="text-base font-bold leading-tight text-white">{place.name}</h3>

      {place.address && (
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 block text-sm leading-snug text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100 hover:decoration-zinc-400"
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
              className="text-sm font-medium text-blue-400 underline underline-offset-2 hover:text-blue-300"
            >
              {place.linkLabel}
            </a>
          ) : (
            <span className="text-sm text-zinc-400">{place.linkLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
