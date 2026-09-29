"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum, fmtPct, fmtUsd, toNum } from "@/lib/format";
import type { RunnerToken } from "@/lib/types";
import { CopyButton } from "./copy-button";
import { RunnerScoreRing } from "./runner-score-ring";
import { SecurityPanel } from "./security-panel";
import { VerdictBadge } from "./severity-badge";
import { BondingBadge } from "./bonding-badge";
import { BuyRecommendationPill } from "./buy-recommendation-pill";
import { useWatchlist } from "./use-watchlist";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface TokenDetailDrawerProps {
  token: RunnerToken | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// Right-side drawer (Sheet) showing the full token detail + every guardrail.
// Re-uses the SecurityPanel so the guardrails surfaced here are exactly what
// gated the token in the runner feed.
export function TokenDetailDrawer({ token, open, onOpenChange }: TokenDetailDrawerProps) {
  const wl = useWatchlist();
  if (!token) return null;
  const star = wl.has(token.tokenId);
  const liq = toNum(token.main_pair_tvl ?? token.tvl);
  const mcap = toNum(token.market_cap);
  const fdv = toNum(token.fdv);
  const vol1h = toNum(token.token_tx_volume_usd_1h);
  const vol24h = toNum(token.token_tx_volume_usd_24h ?? token.tx_volume_u_24h);
  const holders = toNum(token.holders);
  const pct1h = toNum(token.token_price_change_1h ?? token.price_change_1d);
  const pct24h = toNum(token.token_price_change_24h ?? token.price_change_24h);
  const buyers1h = toNum(token.token_buyers_1h);
  const sellers1h = toNum(token.token_sellers_1h);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col"
        aria-label={`${token.symbol} detail`}
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30">
              {token.logo_url ? (
                <img src={token.logo_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-violet-200">{token.symbol?.slice(0, 2).toUpperCase() || "??"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2">
                <span>{token.symbol}</span>
                {token.rugReport && <VerdictBadge verdict={token.rugReport.verdict} />}
              </SheetTitle>
              <SheetDescription className="truncate" title={token.name}>{token.name}</SheetDescription>
            </div>
            <RunnerScoreRing score={token.runnerScore} grade={token.runnerGrade} size={48} />
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-4">
            {/* CA — always copyable, very prominent */}
            <div className="rounded-md border border-border bg-card/40 p-2.5">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Contract address</div>
              <div className="flex items-center justify-between gap-2">
                <code className="mono block truncate text-xs">{token.token}</code>
                <div className="flex items-center gap-1">
                  <CopyButton value={token.token} label="contract address" variant="ghost" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      wl.toggle({
                        tokenId: token.tokenId,
                        chain: token.chain,
                        token: token.token,
                        symbol: token.symbol,
                        name: token.name,
                        logo: token.logo_url,
                      })
                    }
                    aria-label={star ? "Remove from watchlist" : "Add to watchlist"}
                  >
                    <Star className={cn("h-4 w-4", star ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
                <a href={token.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                  Block explorer <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <a href={token.aveUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                  Ave.ai <ExternalLink className="h-2.5 w-2.5" />
                </a>
                {token.socials.website && (
                  <a href={token.socials.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                    Website <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {token.socials.twitter && (
                  <a href={token.socials.twitter} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                    Twitter <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {token.socials.telegram && (
                  <a href={token.socials.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground">
                    Telegram <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Buy recommendation — most prominent call to action */}
            {token.recommendation && (
              <div
                className={cn(
                  "rounded-md border p-3",
                  token.recommendation.action === "strong_buy" && "border-emerald-500/40 bg-emerald-500/10",
                  token.recommendation.action === "watch" && "border-amber-500/40 bg-amber-500/10",
                  token.recommendation.action === "skip" && "border-rose-500/40 bg-rose-500/10",
                  token.recommendation.action === "neutral" && "border-border bg-muted/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <BuyRecommendationPill rec={token.recommendation} size="md" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    confidence {token.recommendation.confidence}%
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {token.recommendation.reason}
                </p>
              </div>
            )}

            {/* Bonding-curve / early-liquidity status */}
            {token.bonding && (
              <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <BondingBadge bonding={token.bonding} />
                  {token.bonding.migrationTarget && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      target: {token.bonding.migrationTarget}
                    </span>
                  )}
                </div>
                <Progress value={token.bonding.progress} className="h-2" />
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {token.bonding.detail}
                </p>
              </div>
            )}

            {/* Market stats grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Price" value={fmtUsd(token.current_price_usd, { compact: false })} />
              <Stat label="Market cap" value={fmtUsd(mcap)} />
              <Stat label="FDV" value={fmtUsd(fdv)} />
              <Stat label="Liquidity" value={fmtUsd(liq)} sub="main-pair TVL" />
              <Stat label="Vol 1h" value={fmtUsd(vol1h)} />
              <Stat label="Vol 24h" value={fmtUsd(vol24h)} />
              <Stat label="Holders" value={fmtNum(holders)} />
              <Stat label="Age" value={token.ageLabel} />
              <Stat label="Chain" value={token.chain.toUpperCase()} />
            </div>

            {/* Momentum */}
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="1h change"
                value={fmtPct(pct1h)}
                sub={pct1h >= 0 ? "bullish" : "bearish"}
              />
              <Stat
                label="24h change"
                value={fmtPct(pct24h)}
                sub={pct24h >= 0 ? "bullish" : "bearish"}
              />
              <Stat label="Buyers 1h" value={fmtNum(buyers1h, false)} />
              <Stat label="Sellers 1h" value={fmtNum(sellers1h, false)} />
            </div>

            {/* Potential multiple highlight */}
            <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-violet-300/80">Runner upside</div>
                  <div className="text-2xl font-bold text-violet-200">{token.potentialMultipleLabel}</div>
                </div>
                <Badge className="bg-violet-500/15 text-violet-200 border-violet-500/30">≈ headroom to $5M</Badge>
              </div>
              <p className="mt-2 text-[11px] text-violet-100/70">
                A rough ceiling estimate based on current market cap versus a typical
                micro-cap local top. Not financial advice — and definitely not a
                guarantee. Always pair this with the guardrails below.
              </p>
            </div>

            <Separator />

            {/* Guardrails */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">Rugpull guardrails</h4>
              <SecurityPanel report={token.rugReport} />
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
