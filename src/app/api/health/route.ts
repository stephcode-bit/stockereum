import { NextResponse } from "next/server";
import { demoMode, hasAveApiKey } from "@/lib/ave-api";
import { cacheStats } from "@/lib/cache";

// GET /api/health — quick health probe used by the dashboard to surface
// whether the Ave.ai key is configured, plus cache stats for debugging.
export async function GET() {
  return NextResponse.json({
    status: "ok",
    aveApiKeyConfigured: hasAveApiKey(),
    demoMode: demoMode(),
    cache: cacheStats(),
    timestamp: Date.now(),
  });
}
