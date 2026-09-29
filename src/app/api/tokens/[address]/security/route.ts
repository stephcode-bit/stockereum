import { NextResponse } from "next/server";
import { demoMode } from "@/lib/ave-api";
import { buildRugReport } from "@/lib/rugcheck";
import { DEMO_RUNNERS } from "@/lib/demo-data";
import { STOCKEREUM_CHAIN } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface RouteParams {
  params: Promise<{ address: string }>;
}

/**
 * GET /api/tokens/[address]/security?chain=eth
 *
 * Returns the full Contract Risk Detection Report broken down into our
 * structured RugReport (checks + verdict + safety score). Used by the
 * token detail drawer so users can audit every guardrail.
 */
export async function GET(_req: Request, { params }: RouteParams) {
  const { address } = await params;
  const url = new URL(_req.url);
  const chain = url.searchParams.get("chain") || STOCKEREUM_CHAIN;

  const [rawAddr, maybeChain] = address.split("-");
  const effectiveChain = maybeChain || chain;
  const tokenId = `${rawAddr}-${effectiveChain}`;

  if (demoMode()) {
    const token = DEMO_RUNNERS.find((t) => t.token === rawAddr && t.chain === effectiveChain);
    if (!token) {
      return NextResponse.json({ status: "error", error: "Token not found in demo data" }, { status: 404 });
    }
    const report = await buildRugReport(token);
    return NextResponse.json({ status: "ok", report, demoMode: true });
  }

  // Live mode: buildRugReport fetches the contract report itself.
  // We synthesise a minimal AveToken shape so the engine has chain + CA.
  const token = { token: rawAddr, chain: effectiveChain };
  try {
    const report = await buildRugReport(token as never);
    return NextResponse.json({ status: "ok", report, demoMode: false });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "failed to load security report" },
      { status: 500 },
    );
  }
}
