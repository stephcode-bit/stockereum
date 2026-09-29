import "server-only";
import {
  AveContractReport,
  AveListResponse,
  AveSupportedChain,
  AveToken,
  AveTrendingResponse,
} from "@/lib/types";
import { getCached, setCached, TTL } from "@/lib/cache";

const BASE = "https://prod.ave-api.com/v2";

export function aveApiKey(): string | undefined {
  return process.env.AVE_API_KEY?.trim() || undefined;
}

export function hasAveApiKey(): boolean {
  return !!aveApiKey();
}

// Custom error type so callers can branch on auth failures vs transient network issues.
export class AveApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, opts: { status?: number; code?: string } = {}) {
    super(message);
    this.name = "AveApiError";
    this.status = opts.status ?? 0;
    this.code = opts.code ?? "AVE_ERROR";
  }
}

async function aveFetch<T>(path: string, init?: RequestInit & { cacheTtl?: number }): Promise<T> {
  const key = aveApiKey();
  if (!key) {
    // No API key configured — surface a clean error so route handlers can switch
    // the response into demo mode.
    throw new AveApiError("AVE_API_KEY is not configured", { code: "AVE_NO_API_KEY" });
  }
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const cacheKey = `ave:${url}`;
  if (init?.cacheTtl) {
    const cached = getCached<T>(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(url, {
    ...init,
    method: init?.method ?? "GET",
    headers: {
      "X-API-KEY": key,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    // Make these calls fast-fail so the dashboard never hangs on Ave.ai.
    next: { revalidate: 0 },
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) {
    throw new AveApiError("Ave.ai rejected the API key", { status: res.status, code: "AVE_AUTH" });
  }
  if (res.status === 429) {
    throw new AveApiError("Ave.ai rate limit hit — try again in a moment", { status: 429, code: "AVE_RATE_LIMIT" });
  }
  if (!res.ok) {
    throw new AveApiError(`Ave.ai request failed: ${res.status} ${res.statusText}`, { status: res.status, code: "AVE_HTTP" });
  }

  const json = (await res.json()) as AveListResponse<T>;
  if (json.status !== 1) {
    throw new AveApiError(`Ave.ai returned error: ${json.msg || "unknown"}`, { code: "AVE_API_STATUS" });
  }

  const value = json.data as T;
  if (init?.cacheTtl) setCached(cacheKey, value, init.cacheTtl);
  return value;
}

// --- Endpoint wrappers --------------------------------------------------

/** GET /v2/supported_chains */
export async function getSupportedChains(): Promise<AveSupportedChain[]> {
  try {
    return await aveFetch<AveSupportedChain[]>("/v2/supported_chains", { cacheTtl: TTL.supportedChains });
  } catch (err) {
    if (err instanceof AveApiError && err.code === "AVE_NO_API_KEY") {
      return DEMO_CHAIN_FALLBACK;
    }
    throw err;
  }
}

/** GET /v2/tokens/trending?chain=...&page_size=... */
export async function getTrending(chain: string, pageSize = 50): Promise<AveTrendingResponse> {
  const url = `/v2/tokens/trending?chain=${encodeURIComponent(chain)}&page_size=${pageSize}`;
  return aveFetch<AveTrendingResponse>(url, { cacheTtl: TTL.trending });
}

/** GET /v2/ranks?topic=...&limit=... */
export async function getRankByTopic(topic: string, limit = 200): Promise<AveToken[]> {
  const url = `/v2/ranks?topic=${encodeURIComponent(topic)}&limit=${limit}`;
  return aveFetch<AveToken[]>(url, { cacheTtl: TTL.ranks });
}

/** GET /v2/tokens?keyword=...&chain=...&limit=... */
export async function searchTokens(keyword: string, chain?: string, limit = 50): Promise<AveToken[]> {
  const params = new URLSearchParams({ keyword, limit: String(limit) });
  if (chain) params.set("chain", chain);
  const url = `/v2/tokens?${params.toString()}`;
  return aveFetch<AveToken[]>(url, { cacheTtl: TTL.search });
}

/** GET /v2/tokens/{token-id}  — full token detail. */
export async function getTokenDetail(tokenId: string): Promise<AveToken> {
  return aveFetch<AveToken>(`/v2/tokens/${encodeURIComponent(tokenId)}`, { cacheTtl: TTL.tokenDetail });
}

/** GET /v2/contracts/{token-id}  — Contract Risk Detection Report (rugpull check). */
export async function getContractReport(tokenId: string): Promise<AveContractReport> {
  return aveFetch<AveContractReport>(`/v2/contracts/${encodeURIComponent(tokenId)}`, { cacheTtl: TTL.contractReport });
}

/** GET /v2/tokens/top100/{token-id} — top holders for concentration analysis. */
export async function getTopHolders(tokenId: string, limit = 100): Promise<unknown[]> {
  return aveFetch<unknown[]>(`/v2/tokens/top100/${encodeURIComponent(tokenId)}?limit=${limit}`, {
    cacheTtl: TTL.holders,
  });
}

/** GET /v2/klines/token/{token-id} — price candles for sparkline rendering. */
export interface KlinePoint {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  time: number;
}
export interface KlineResponse {
  points: KlinePoint[];
  total_count?: number;
  to_time?: number;
  limit?: number;
  interval?: number;
  pair_id?: string;
  target_token_id?: string;
}
export async function getTokenKlines(tokenId: string, interval = 5, size = 30): Promise<KlineResponse> {
  const url = `/v2/klines/token/${encodeURIComponent(tokenId)}?interval=${interval}&size=${size}`;
  return aveFetch<KlineResponse>(url, { cacheTtl: TTL.kline });
}

// --- Demo fallback when no API key is present ---------------------------
// Realistic-looking sample tokens so the UI is fully explorable before the user
// drops in their own AVE_API_KEY. These mirror the Ave.ai response shape exactly.

const DEMO_CHAIN_FALLBACK: AveSupportedChain[] = [
  {
    chain_id: "1",
    name: "Ethereum",
    chain: "eth",
    description: "Stockereum launchpad chain",
    block_explorer_url: "https://etherscan.io",
    case_sensitive: false,
    only_native_coin: false,
  },
  {
    chain_id: "solana",
    name: "Solana",
    chain: "solana",
    description: "Solana",
    block_explorer_url: "https://solscan.io",
    case_sensitive: true,
    only_native_coin: false,
  },
];

// Public helper that flips into demo mode if no API key is configured.
export function demoMode(): boolean {
  return !hasAveApiKey();
}
