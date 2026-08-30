"use client";

import dynamic from "next/dynamic";

// deck.gl + MapLibre touch `window` at import time, so load them only on the client.
const PhotographyMap = dynamic(() => import("@/components/PhotographyMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh w-full place-items-center bg-[#0a0c12] text-sm text-zinc-400">
      Loading map…
    </div>
  ),
});

export default function MapClient() {
  return <PhotographyMap />;
}
