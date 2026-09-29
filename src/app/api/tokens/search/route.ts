import { NextResponse } from "next/server";
import { demoMode, AveApiError, searchTokens } from "@/lib/ave-api";
import { DEMO_RUNNERS } from "@/lib/demo-data";
import { buildRugReport } from "@/lib/rugcheck";
import { RunnerToken, STOCKEREUM_CHAIN, AveToken } from "@/lib/types";
import { ageLabelFromUnixSec, toNum } from "@/lib/format";
import { explorerFor } from "@/lib/runner-detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseAppendix(raw?: string): RunnerToken["socials"] {
  if (!raw) return {};
  try {
    const a = JSON.parse(raw) as Record<string, string>;
    return {
      website: a.website,
      twitter: a.twitter,
      telegram: a.telegram,
      discord: a.discord,
      github: a.github,
      description: a.description,
    };
  } catch {
    return {};
  }
}

// Builds a runner-token shell WITHOUT applying the runner candidate gate. This
// is what we use for the Search tab: if a user pastes a CA they want to see
// the token regardless of whether it's a runner candidate (it might be a
// known rugpull, a token that already pumped, etc.) — the rug report tells
// them what they need to know.
async function buildSearchResult(token: AveToken): Promise<RunnerToken> {
  const createdAtSec = toNum(token.launch_at ?? token.created_at);
  const now = Date.now();
  const ageMs = createdAtSec > 0 ? now - createdAtSec * 1000 : NaN;
  const rug = await buildRugReport(token).catch(() => undefined);
  return {
    ...token,
    tokenId: `${token.token}-${token.chain}`,
    ageSeconds: Number.isFinite(ageMs) ? Math.floor(ageMs / 1000) : 0,
    ageLabel: ageLabelFromUnixSec(createdAtSec, now),
    runnerScore: rug?.safetyScore ?? 0,
    runnerGrade: rug?.verdict === "safe" ? "A" : rug?.verdict === "caution" ? "C" : "D",
    runnerBreakdown: {
      age: 0, liquidity: 0, volumeAccel: 0, buyerPressure: 0,
      priceMomentum: 0, holderBase: 0,
      safety: rug ? rug.safetyScore / 100 : 0,
    },
    potentialMultiple: 0,
    potentialMultipleLabel: "—",
    rugReport: rug,
    socials: parseAppendix(token.appendix),
    explorerUrl: explorerFor(token.chain, token.token),
    aveUrl: `https://www.ave.ai/token/${token.token}-${token.chain}`,
  };
}

/**
 * GET /api/tokens/search?keyword=...&chain=...
 *
 * Searches by symbol OR contract address. Returns RunnerToken[] (with rug
 * reports attached) WITHOUT applying the runner candidate gate — so users
 * can look up any token (including known rugs) and see its guardrails. The
 * runner score in search results is the safety score; runner status is
 * surfaced via the verdict badge.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const keyword = (url.searchParams.get("keyword") ?? "").trim();
  const chain = url.searchParams.get("chain") || STOCKEREUM_CHAIN;

  if (!keyword) {
    return NextResponse.json({ status: "ok", runners: [], demoMode: demoMode() });
  }

  try {
    let raw: AveToken[];
    if (demoMode()) {
      const k = keyword.toLowerCase();
      raw = DEMO_RUNNERS.filter(
        (t) =>
          t.chain === chain &&
          (t.symbol.toLowerCase().includes(k) ||
            t.name.toLowerCase().includes(k) ||
            t.token.toLowerCase().includes(k)),
      );
    } else {
      raw = await searchTokens(keyword, chain, 50);
    }
    // De-dupe + build shells (no candidate gate).
    const seen = new Set<string>();
    const unique = raw.filter((t) => {
      const key = `${t.token}-${t.chain}`;
      if (seen.has(key) || !t.token || !t.chain) return false;
      seen.add(key);
      return true;
    });
    const built = await Promise.all(unique.map((t) => buildSearchResult(t).catch(() => null)));
    const runners = built.filter((r): r is RunnerToken => r !== null);
    return NextResponse.json({ status: "ok", runners, demoMode: demoMode() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "search failed";
    const code = err instanceof AveApiError ? err.code : "INTERNAL";
    return NextResponse.json({ status: "error", error: message, code, demoMode: demoMode() }, { status: 500 });
  }
}
