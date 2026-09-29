import { NextResponse } from "next/server";
import { demoMode, AveApiError, getRankByTopic, getTrending } from "@/lib/ave-api";
import { DEMO_RUNNERS } from "@/lib/demo-data";
import { buildRunnerFeed, DEFAULT_RUNNER_TOPICS, runnerPassesUserFilters } from "@/lib/runner-detector";
import { STOCKEREUM_CHAIN, AveToken, RunnerToken } from "@/lib/types";
import { getCached, setCached, TTL } from "@/lib/cache";

export const runtime = "nodejs";
// Runners route runs the rug-check engine which does its own fetches, so allow
// up to 30s. Vercel's default is 10s which can be too tight when Ave.ai is slow.
export const maxDuration = 30;
// Always revalidate — runners must stay fresh.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RunnersQuery {
  chain?: string;
  minScore?: number;
  minLiquidityUsd?: number;
  maxAgeHours?: number;
  requireSafe?: string | undefined;
  bondingOnly?: string | undefined;
  strongBuyOnly?: string | undefined;
  limit?: number;
  topic?: string;
}

function parseQuery(url: URL): RunnersQuery {
  const q = url.searchParams;
  return {
    chain: q.get("chain") || STOCKEREUM_CHAIN,
    minScore: q.get("minScore") ? Number(q.get("minScore")) : undefined,
    minLiquidityUsd: q.get("minLiquidityUsd") ? Number(q.get("minLiquidityUsd")) : undefined,
    maxAgeHours: q.get("maxAgeHours") ? Number(q.get("maxAgeHours")) : undefined,
    requireSafe: q.get("requireSafe") ?? undefined,
    bondingOnly: q.get("bondingOnly") ?? undefined,
    strongBuyOnly: q.get("strongBuyOnly") ?? undefined,
    limit: q.get("limit") ? Number(q.get("limit")) : 60,
    topic: q.get("topic") ?? undefined,
  };
}

/**
 * Aggregate sources we feed into the runner engine. We deliberately combine
 * multiple Ave.ai endpoints so we don't miss early runners:
 *
 *   - /v2/tokens/trending?chain=<chain>  — hottest tokens on the chain
 *   - /v2/ranks?topic=new&limit=300      — newest launches across all chains
 *   - /v2/ranks?topic=gainer&limit=300   — biggest gainers
 *   - /v2/ranks?topic=<chain>&limit=300  — chain-specific rank
 *
 * In demo mode (no AVE_API_KEY) we just return the curated sample list so the
 * UI is fully functional for evaluation.
 */
async function gatherCandidates(chain: string, topicFilter?: string): Promise<AveToken[]> {
  if (demoMode()) {
    // Filter demo tokens by chain so the UI selector still works.
    return DEMO_RUNNERS.filter((t) => t.chain === chain);
  }

  const topics = topicFilter ? [topicFilter] : DEFAULT_RUNNER_TOPICS;
  const sources: AveToken[] = [];

  // Trending on the target chain — synchronous, no fan-out needed.
  try {
    const trending = await getTrending(chain, 100);
    if (trending.tokens?.length) sources.push(...trending.tokens);
  } catch (err) {
    if (err instanceof AveApiError && err.code === "AVE_AUTH") throw err;
    // transient / network — we still want the rank endpoints to run
    console.warn("trending fetch failed", err);
  }

  // Fan out the rank topic calls. Promise.allSettled so one slow topic can't
  // block the whole feed.
  const settled = await Promise.allSettled(topics.map((t) => getRankByTopic(t, 300)));
  for (const r of settled) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) sources.push(...r.value);
  }

  return sources;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = parseQuery(url);

  // Cache key includes all user filters so different filter states don't collide.
  const cacheKey = `runners:${q.chain}:${q.topic ?? "all"}:${q.minScore ?? 0}:${q.minLiquidityUsd ?? 0}:${q.maxAgeHours ?? 0}:${q.requireSafe ?? "0"}:${q.bondingOnly ?? "0"}:${q.strongBuyOnly ?? "0"}`;
  const cached = getCached<{ runners: RunnerToken[]; demoMode: boolean; generatedAt: number }>(cacheKey);
  if (cached) return NextResponse.json({ status: "ok", ...cached, cached: true });

  try {
    const raw = await gatherCandidates(q.chain!, q.topic);

    // Keep only tokens that are on the requested chain when topic filter is set
    // (some topic endpoints are cross-chain, e.g. "new" mixes all chains).
    const scoped = q.topic && q.topic !== q.chain ? raw.filter((t) => t.chain === q.chain) : raw;

    const runners = await buildRunnerFeed(scoped);

    const filtered = runners
      .filter((r) =>
        runnerPassesUserFilters(r, {
          minScore: q.minScore,
          minLiquidityUsd: q.minLiquidityUsd,
          maxAgeHours: q.maxAgeHours,
          requireSafeVerdict: q.requireSafe === "1" || q.requireSafe === "true",
          bondingOnly: q.bondingOnly === "1" || q.bondingOnly === "true",
          strongBuyOnly: q.strongBuyOnly === "1" || q.strongBuyOnly === "true",
        }),
      )
      .slice(0, q.limit ?? 60);

    const payload = {
      runners: filtered,
      demoMode: demoMode(),
      generatedAt: Date.now(),
      totalCandidates: scoped.length,
      totalRunners: runners.length,
      filters: q,
    };
    setCached(cacheKey, payload, TTL.runners);
    return NextResponse.json({ status: "ok", ...payload, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    const code = err instanceof AveApiError ? err.code : "INTERNAL";
    const status = err instanceof AveApiError ? (err.status || 500) : 500;
    return NextResponse.json(
      { status: "error", error: message, code, demoMode: demoMode() },
      { status },
    );
  }
}
