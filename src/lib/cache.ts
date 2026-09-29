// Simple in-memory TTL cache used to keep Ave.ai calls reasonable and the PWA snappy.
// Keys are scoped per-chain so concurrent requests for different chains don't collide.

interface Entry<V> {
  value: V;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function getCached<V>(key: string): V | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as V;
}

export function setCached<V>(key: string, value: V, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}

// Stagger quick refresh windows: token lists refresh aggressively (15s),
// contract risk reports refresh slowly (5 min) since on-chain facts change rarely.
export const TTL = {
  runners: 15_000,          // 15s — runner feed must stay fresh
  tokenDetail: 30_000,      // 30s
  contractReport: 300_000,  // 5 min
  supportedChains: 3_600_000, // 1h
  search: 20_000,           // 20s
  trending: 30_000,         // 30s
  ranks: 30_000,            // 30s
  holders: 120_000,         // 2 min
  kline: 30_000,            // 30s
} as const;
