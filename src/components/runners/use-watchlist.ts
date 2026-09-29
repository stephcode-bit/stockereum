"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "stockereum.watchlist.v1";

export interface WatchlistEntry {
  tokenId: string;       // {CA}-{chain}
  chain: string;
  token: string;         // CA
  symbol: string;
  name?: string;
  logo?: string;
  addedAt: number;
}

function read(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function write(list: WatchlistEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    // Notify other hook instances (other tabs / components) so they stay in sync.
    window.dispatchEvent(new CustomEvent("watchlist:changed", { detail: list }));
  } catch {
    /* quota exceeded / private mode — best effort */
  }
}

// Persists the user's watchlist in localStorage. Synced across components via
// a custom event so the watchlist tab updates instantly when a card is
// starred. SSR-safe: initial state is empty until the effect rehydrates.
export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Defer the initial read to a microtask so we don't call setState
    // synchronously inside the effect body (which React 19 flags as a
    // potential cascading-render source). The rehydrate happens before the
    // browser paints, so users never see a flash of the empty state.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setEntries(read());
      setHydrated(true);
    });
    const onChange = (e?: Event) => {
      const detail = (e as CustomEvent | undefined)?.detail;
      queueMicrotask(() => {
        if (cancelled) return;
        setEntries(Array.isArray(detail) ? (detail as WatchlistEntry[]) : read());
      });
    };
    window.addEventListener("watchlist:changed", onChange as EventListener);
    window.addEventListener("storage", onChange as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("watchlist:changed", onChange as EventListener);
      window.removeEventListener("storage", onChange as EventListener);
    };
  }, []);

  const has = useCallback(
    (tokenId: string) => entries.some((e) => e.tokenId === tokenId),
    [entries],
  );

  const toggle = useCallback((entry: Omit<WatchlistEntry, "addedAt">) => {
    const list = read();
    const idx = list.findIndex((e) => e.tokenId === entry.tokenId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push({ ...entry, addedAt: Date.now() });
    }
    write(list);
    setEntries(list);
  }, []);

  const remove = useCallback((tokenId: string) => {
    const list = read().filter((e) => e.tokenId !== tokenId);
    write(list);
    setEntries(list);
  }, []);

  const clear = useCallback(() => {
    write([]);
    setEntries([]);
  }, []);

  return { entries, has, toggle, remove, clear, hydrated };
}
