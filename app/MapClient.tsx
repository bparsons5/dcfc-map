"use client";

import dynamic from "next/dynamic";

// deck.gl + MapLibre touch `window` at import time, so load them only on the client.
const PhotographyMap = dynamic(() => import("@/components/PhotographyMap"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#0a0c12] text-zinc-300">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p className="text-sm font-medium">Loading map…</p>
      </div>
    </div>
  ),
});

export default function MapClient() {
  return <PhotographyMap />;
}
