"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Github,
  ShieldCheck,
  Sparkles,
  Search as SearchIcon,
  Star,
  TrendingUp,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, fmtUsd, toNum } from "@/lib/format";
import type { RunnerToken } from "@/lib/types";
import { TokenCard } from "@/components/runners/token-card";
import { TokenDetailDrawer } from "@/components/runners/token-detail-drawer";
import { FiltersBar, type RunnerFilters } from "@/components/runners/filters-bar";
import { EmptyState, ErrorState, LoadingState } from "@/components/runners/states";
import { useWatchlist } from "@/components/runners/use-watchlist";
import { toast } from "sonner";

interface RunnersResponse {
  status: "ok" | "error";
  runners?: RunnerToken[];
  demoMode?: boolean;
  generatedAt?: number;
  totalCandidates?: number;
  totalRunners?: number;
  filters?: RunnerFilters;
  cached?: boolean;
  error?: string;
  code?: string;
}

interface HealthResponse {
  status: "ok";
  aveApiKeyConfigured: boolean;
  demoMode: boolean;
  cache?: { size: number };
  timestamp: number;
}

interface ChainEntry { chain: string; name: string; }

const DEFAULT_FILTERS: RunnerFilters = {
  chain: "eth", // Stockereum chain (Ethereum)
  minScore: 30,
  minLiquidityUsd: 5_000,
  maxAgeHours: 168, // 7 days — broad enough to never miss a runner
  requireSafe: false,
  bondingOnly: false,
  strongBuyOnly: false,
  topic: undefined,
  keyword: undefined,
};

// Auto-refresh interval — runners must stay fresh. 30s strikes a balance
// between freshness and Ave.ai rate limits.
const AUTO_REFRESH_MS = 30_000;

export default function Home() {
  const [tab, setTab] = useState<"runners" | "search" | "watchlist">("runners");
  const [filters, setFilters] = useState<RunnerFilters>(DEFAULT_FILTERS);
  const [runners, setRunners] = useState<RunnerToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [chains, setChains] = useState<ChainEntry[]>([{ chain: "eth", name: "Ethereum (Stockereum)" }]);

  const [selected, setSelected] = useState<RunnerToken | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RunnerToken[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const wl = useWatchlist();
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch runners from /api/runners. Uses query params so the cache is keyed
  // correctly per filter combination.
  const fetchRunners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        chain: filters.chain,
        minScore: String(filters.minScore),
        minLiquidityUsd: String(filters.minLiquidityUsd),
        maxAgeHours: String(filters.maxAgeHours),
        requireSafe: filters.requireSafe ? "1" : "0",
        bondingOnly: filters.bondingOnly ? "1" : "0",
        strongBuyOnly: filters.strongBuyOnly ? "1" : "0",
      });
      if (filters.topic) params.set("topic", filters.topic);
      const res = await fetch(`/api/runners?${params.toString()}`, { cache: "no-store" });
      const json: RunnersResponse = await res.json();
      if (json.status === "ok") {
        setRunners(json.runners ?? []);
        setDemoMode(!!json.demoMode);
        setGeneratedAt(json.generatedAt ?? null);
        setLastUpdated(Date.now());
      } else {
        setError(json.error || "Failed to load runners");
        setDemoMode(!!json.demoMode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load + auto-refresh.
  useEffect(() => {
    fetchRunners();
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => {
      // Only auto-refresh when the user is on the runners tab and the document
      // is visible — saves rate-limit budget on backgrounded tabs.
      if (document.visibilityState === "visible" && tab === "runners") {
        fetchRunners();
      }
    }, AUTO_REFRESH_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [fetchRunners, tab]);

  // Fetch health + chains once on mount.
  useEffect(() => {
    (async () => {
      try {
        const h = await fetch("/api/health", { cache: "no-store" });
        const hj: HealthResponse = await h.json();
        setHealth(hj);
      } catch {
        /* non-fatal */
      }
      try {
        const c = await fetch("/api/chains", { cache: "no-store" });
        const cj = await c.json();
        if (cj.chains?.length) {
          setChains(cj.chains.map((x: { chain: string; name: string; description?: string }) => ({ chain: x.chain, name: x.name })));
        }
      } catch {
        /* fall back to eth-only */
      }
    })();
  }, []);

  // Debounced search for the Search tab.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ keyword: q, chain: filters.chain });
        const res = await fetch(`/api/tokens/search?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (json.status === "ok") setSearchResults(json.runners ?? []);
        else setSearchError(json.error || "Search failed");
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Network error");
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [searchQuery, filters.chain]);

  const onOpen = useCallback((t: RunnerToken) => {
    setSelected(t);
    setDrawerOpen(true);
  }, []);

  const onRefresh = useCallback(() => {
    toast.promise(fetchRunners(), {
      loading: "Refreshing runners…",
      success: () => "Runners refreshed",
      error: (err: unknown) => `Refresh failed: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }, [fetchRunners]);

  // Summary stats banner.
  const summary = useMemo(() => {
    if (!runners.length) return null;
    const safe = runners.filter((r) => r.rugReport?.verdict === "safe").length;
    const caution = runners.filter((r) => r.rugReport?.verdict === "caution").length;
    const danger = runners.filter((r) => r.rugReport?.verdict === "danger").length;
    const totalLiq = runners.reduce((s, r) => s + toNum(r.main_pair_tvl ?? r.tvl), 0);
    // "Still bonding" = bonding-curve OR early-liquidity phase. These are the
    // very-early runners the user explicitly asked to surface.
    const stillBonding = runners.filter((r) => {
      const s = r.bonding?.status;
      return s === "bonding" || s === "early_liquidity";
    }).length;
    const strongBuys = runners.filter((r) => r.recommendation?.action === "strong_buy").length;
    return { safe, caution, danger, totalLiq, count: runners.length, stillBonding, strongBuys };
  }, [runners]);

  // Derived watchlist entries (live tokens from the runner feed if available,
  // otherwise the persisted entries).
  const watchlistTokens = useMemo<RunnerToken[]>(() => {
    return wl.entries
      .map((entry) => {
        const live = runners.find((r) => r.tokenId === entry.tokenId);
        if (live) return live;
        // Build a minimal RunnerToken shell so the card renders.
        return {
          token: entry.token,
          chain: entry.chain,
          name: entry.name || entry.symbol || "Unknown",
          symbol: entry.symbol,
          logo_url: entry.logo,
          tokenId: entry.tokenId,
          ageSeconds: 0,
          ageLabel: "—",
          runnerScore: 0,
          runnerGrade: "D" as const,
          runnerBreakdown: { age: 0, liquidity: 0, volumeAccel: 0, buyerPressure: 0, priceMomentum: 0, holderBase: 0, safety: 0 },
          potentialMultiple: 0,
          potentialMultipleLabel: "—",
          socials: {},
          explorerUrl: `https://etherscan.io/token/${entry.token}`,
          aveUrl: `https://www.ave.ai/token/${entry.tokenId}`,
        } as RunnerToken;
      });
  }, [wl.entries, runners]);

  return (
    <>
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2.5">
              <img src="/icon.svg" alt="" className="h-8 w-8" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-tight sm:text-base">
                  <span className="eth-shimmer-text">Stockereum Runner Radar</span>
                </h1>
                <p className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:block">
                  Early runner detection · Ave.ai v2 · Ethereum
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {health && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-[10px]",
                    health.aveApiKeyConfigured
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                  )}
                  title={health.aveApiKeyConfigured ? "Live Ave.ai feed" : "Demo mode — set AVE_API_KEY for live data"}
                >
                  <span className={cn("pulse-dot h-1.5 w-1.5 rounded-full", health.aveApiKeyConfigured ? "bg-emerald-400" : "bg-amber-400")} />
                  {health.aveApiKeyConfigured ? "Live" : "Demo"}
                </Badge>
              )}
              <a
                href="https://docs.ave.ai/reference/api-reference/v2"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex"
              >
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Github className="h-3.5 w-3.5" /> Ave.ai Docs
                </Button>
              </a>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4">
          {/* Hero summary */}
          {summary && (
            <Card className="mb-4 border-border bg-gradient-to-br from-violet-500/10 via-card/80 to-card/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-violet-300" />
                  <div>
                    <h2 className="text-sm font-semibold">
                      <span className="eth-shimmer-text">{summary.count} live runner{summary.count === 1 ? "" : "s"}</span>
                    </h2>
                    <p className="text-[10px] text-muted-foreground">
                      Total liquidity {fmtUsd(summary.totalLiq)} · auto-refresh every 30s
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {summary.stillBonding > 0 && (
                    <span className="rounded border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-200" title="Tokens still on a bonding curve or in the early-liquidity building phase — the pre-run window">
                      {summary.stillBonding} still bonding
                    </span>
                  )}
                  {summary.strongBuys > 0 && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-200" title="Tokens our engine actively recommends buying">
                      {summary.strongBuys} strong buy
                    </span>
                  )}
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                    {summary.safe} safe
                  </span>
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                    {summary.caution} caution
                  </span>
                  <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-rose-300">
                    {summary.danger} danger
                  </span>
                </div>
              </div>
            </Card>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="runners" className="gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Runners</span>
                {runners.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{runners.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-1.5 text-xs">
                <SearchIcon className="h-3.5 w-3.5" />
                <span>Search</span>
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="gap-1.5 text-xs">
                <Star className="h-3.5 w-3.5" />
                <span>Watchlist</span>
                {wl.entries.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{wl.entries.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* Runners tab */}
            <TabsContent value="runners" className="space-y-4">
              <FiltersBar
                value={filters}
                onChange={setFilters}
                onRefresh={onRefresh}
                loading={loading}
                chains={chains}
              />
              {loading && runners.length === 0 ? (
                <LoadingState />
              ) : error ? (
                <ErrorState message={error} demoMode={demoMode} onRetry={fetchRunners} />
              ) : runners.length === 0 ? (
                <EmptyState
                  title="No runners match your filters"
                  description="Try lowering the min runner score, widening the age cap, or turning off the safety filter. New runners appear within minutes of launch."
                  action={{ label: "Reset filters", onClick: () => setFilters(DEFAULT_FILTERS) }}
                />
              ) : (
                <>
                  {demoMode && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-200">
                      <strong>Demo mode is on.</strong> Showing curated sample runners. Set <code className="mono">AVE_API_KEY</code> to see live Stockereum tokens. See the README for setup.
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {runners.map((t) => (
                      <TokenCard key={t.tokenId} token={t} onSelect={onOpen} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Search tab */}
            <TabsContent value="search" className="space-y-4">
              <Card className="border-border bg-card/50 p-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Paste a CA (0x…) or search a symbol — e.g. PEPE"
                    className="pl-9 text-sm"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Results are run through the same runner engine + rugcheck guardrails.
                </p>
              </Card>

              {searchLoading ? (
                <LoadingState label="Searching Ave.ai…" />
              ) : searchError ? (
                <ErrorState message={searchError} demoMode={demoMode} />
              ) : searchQuery && searchResults.length === 0 ? (
                <EmptyState title="No matches" description="Try a different symbol or paste the full contract address." />
              ) : searchResults.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((t) => (
                    <TokenCard key={t.tokenId} token={t} onSelect={onOpen} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Search the Stockereum chain"
                  description="Paste a 0x… contract address or a token symbol to pull the latest risk report from Ave.ai."
                  icon={Sparkles}
                />
              )}
            </TabsContent>

            {/* Watchlist tab */}
            <TabsContent value="watchlist" className="space-y-4">
              <Card className="border-border bg-card/50 p-3 text-xs text-muted-foreground">
                Watchlist lives in your browser&rsquo;s localStorage — perfect for the installed
                PWA. Star tokens from any card or the detail drawer to pin them here.
              </Card>
              {watchlistTokens.length === 0 ? (
                <EmptyState
                  title="Your watchlist is empty"
                  description="Star tokens on any card to pin them here. Your watchlist is saved locally on this device."
                  icon={Star}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{watchlistTokens.length} pinned</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => wl.clear()}
                      className="text-xs text-muted-foreground hover:text-rose-300"
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {watchlistTokens.map((t) => (
                      <TokenCard key={t.tokenId} token={t} onSelect={onOpen} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-border bg-background/80 backdrop-blur">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4">
            <div className="flex flex-col items-start justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Rugpull guardrails powered by Ave.ai&rsquo;s Contract Risk Detection Report.
                </span>
              </div>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Updated {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
                <a
                  href="https://stockereum.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  stockereum.com
                </a>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Not financial advice. Token prices are extremely volatile — never invest
              more than you can afford to lose. The runner score and safety score are
              automated heuristics, not guarantees.
            </p>
          </div>
        </footer>
      </div>

      <TokenDetailDrawer token={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
