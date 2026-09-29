import { NextResponse } from "next/server";
import { demoMode, AveApiError, getTokenDetail } from "@/lib/ave-api";
import { buildRugReport } from "@/lib/rugcheck";
import { DEMO_RUNNERS } from "@/lib/demo-data";
import { RunnerToken, STOCKEREUM_CHAIN } from "@/lib/types";
import { ageLabelFromUnixSec, toNum } from "@/lib/format";
import { explorerFor } from "@/lib/runner-detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ address: string }>;
}

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

function toRunnerFromToken(token: (typeof DEMO_RUNNERS)[number]): RunnerToken {
  const createdAtSec = toNum(token.launch_at ?? token.created_at);
  const now = Date.now();
  return {
    ...token,
    tokenId: `${token.token}-${token.chain}`,
    ageSeconds: createdAtSec > 0 ? Math.floor((now - createdAtSec * 1000) / 1000) : 0,
    ageLabel: ageLabelFromUnixSec(createdAtSec, now),
    runnerScore: 0,
    runnerGrade: "C",
    runnerBreakdown: { age: 0, liquidity: 0, volumeAccel: 0, buyerPressure: 0, priceMomentum: 0, holderBase: 0, safety: 0 },
    potentialMultiple: 0,
    potentialMultipleLabel: "—",
    socials: parseAppendix(token.appendix),
    explorerUrl: explorerFor(token.chain, token.token),
    aveUrl: `https://www.ave.ai/token/${token.token}-${token.chain}`,
  };
}

/**
 * GET /api/tokens/[address]?chain=eth
 *
 * Returns a single token's full detail + rug report. The route resolves the
 * chain from the query string (defaulting to Stockereum = eth). The address
 * may be the CA itself or a full token-id "{CA}-{chain}".
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;

  // Allow both `0xabc...` and `0xabc...-eth` formats.
  const [rawAddr, maybeChain] = address.split("-");
  const chain = maybeChain || STOCKEREUM_CHAIN;
  const tokenId = `${rawAddr}-${chain}`;

  try {
    let token;
    if (demoMode()) {
      token = DEMO_RUNNERS.find((t) => t.token === rawAddr && t.chain === chain);
      if (!token) {
        return NextResponse.json({ status: "error", error: "Token not found in demo data" }, { status: 404 });
      }
    } else {
      token = await getTokenDetail(tokenId);
    }

    // Build the rug report on the fly so /token/[address] always has the freshest
    // guardrails, even if the runner feed was cached.
    const rug = await buildRugReport(token);
    const runner = toRunnerFromToken(token);
    runner.rugReport = rug;

    // Attach a simple runner score using rugcheck + token metrics.
    runner.runnerBreakdown.safety = rug.safetyScore / 100;
    runner.runnerScore = rug.safetyScore;
    runner.runnerGrade = rug.verdict === "safe" ? "A" : rug.verdict === "caution" ? "C" : "D";

    return NextResponse.json({ status: "ok", token: runner, demoMode: demoMode() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to load token";
    const code = err instanceof AveApiError ? err.code : "INTERNAL";
    const status = err instanceof AveApiError ? err.status || 500 : 500;
    return NextResponse.json({ status: "error", error: message, code, demoMode: demoMode() }, { status });
  }
}
