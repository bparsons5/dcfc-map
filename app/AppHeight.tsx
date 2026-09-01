"use client";

import { useEffect } from "react";

/**
 * Mobile browsers — notably iOS Chrome opened from an external link — report an
 * unreliable `vh` / `dvh`, which lets a `position: fixed` container slide up
 * under the status bar and hide the top of the UI.
 *
 * Drive the height from `window.innerHeight` instead, exposed as the CSS custom
 * property `--app-height`, and keep it in sync on resize / orientation change.
 */
export default function AppHeight() {
  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`,
      );
    };

    setAppHeight();
    window.addEventListener("resize", setAppHeight);
    window.addEventListener("orientationchange", setAppHeight);
    window.visualViewport?.addEventListener("resize", setAppHeight);

    return () => {
      window.removeEventListener("resize", setAppHeight);
      window.removeEventListener("orientationchange", setAppHeight);
      window.visualViewport?.removeEventListener("resize", setAppHeight);
    };
  }, []);

  return null;
}
