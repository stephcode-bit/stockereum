"use client";

import { useEffect } from "react";

// Registers the service worker so the PWA can install + work offline.
// Mounted once from the layout; safe to render in production where sw.js exists.
// In dev we skip registration by default (configurable via NEXT_PUBLIC_SW_DEV=1)
// to avoid stale-cache confusion while iterating.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SW_DEV !== "1") return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // swallow — SW is a progressive enhancement, never block UI
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
