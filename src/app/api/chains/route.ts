import { NextResponse } from "next/server";
import { getSupportedChains } from "@/lib/ave-api";

// GET /api/chains — Ave.ai's supported chain list. Used by the chain selector
// in the dashboard header. Falls back to a small static list when no key is set.
export async function GET() {
  try {
    const chains = await getSupportedChains();
    return NextResponse.json({ status: "ok", chains });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: err instanceof Error ? err.message : "failed to load chains" },
      { status: 500 },
    );
  }
}
