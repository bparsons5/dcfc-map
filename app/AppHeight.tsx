"use client";

import { useEffect } from "react";

/**
 * Root client effect. The layout is sized purely with `height: 100%` /
 * `position: fixed; inset: 0` (no vh/dvh, no JS measurement), so all this
 * does is opt out of the browser restoring a stale scroll offset on
 * back-navigation.
 */
export default function AppHeight() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  return null;
}
