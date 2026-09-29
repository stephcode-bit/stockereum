"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Star,
  TrendingUp,
  Users,
  Droplets,
  Flame,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtPct, fmtUsd, fmtNum, toNum } from "@/lib/format";
import type { RunnerToken } from "@/lib/types";
import { CopyButton } from "./copy-button";
import { RunnerScoreRing } from "./runner-score-ring";
import { VerdictBadge } from "./severity-badge";
import { BondingBadge } from "./bonding-badge";
import { BuyRecommendationPill } from "./buy-recommendation-pill";
import { useWatchlist } from "./use-watchlist";
import { Button } from "@/components/ui/button";

interface TokenCardProps {
  token: RunnerToken;
  onSelect?: (token: RunnerToken) => void;
  compact?: boolean;
}

function ChangePill({ value, label }: { value: number; label: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-emerald-300" : "text-rose-300",
      )}
      title={label}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {fmtPct(value)}
    </span>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2" title={hint || `${label}: ${value}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// Primary surface for a single runner. All key facts visible at a glance:
//   - CA (copyable)
//   - runner score ring + grade
//   - safety verdict
//   - liquidity / mcap / holders / age / 24h change
//   - potential multiple (2x-3x)
//   - 1h momentum + buyer/seller pressure
export function TokenCard({ token, onSelect, compact = false }: TokenCardProps) {
  const wl = useWatchlist();
  const star = wl.has(token.tokenId);
  const liq = toNum(token.main_pair_tvl ?? token.tvl);
  const mcap = toNum(token.market_cap);
  const holders = toNum(token.holders);
  const pct1h = toNum(token.token_price_change_1h ?? token.price_change_1d);
  const pct24h = toNum(token.token_price_change_24h ?? token.price_change_24h);
  const buyers1h = toNum(token.token_buyers_1h);
  const sellers1h = toNum(token.token_sellers_1h);
  const verdict = token.rugReport?.verdict;
  const safetyScore = token.rugReport?.safetyScore ?? 0;
  const criticalCount = token.rugReport?.criticalCount ?? 0;
  const warningCount = token.rugReport?.warningCount ?? 0;

  const onStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    wl.toggle({
      tokenId: token.tokenId,
      chain: token.chain,
      token: token.token,
      symbol: token.symbol,
      name: token.name,
      logo: token.logo_url,
    });
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border bg-card/60 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-card/80",
        onSelect && "cursor-pointer",
      )}
      onClick={() => onSelect?.(token)}
    >
      <CardHeader className="pb-3">
        {/* Buy recommendation pill — full-width, top of card */}
        {token.recommendation && (
          <div className={cn(
            "mb-2 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5",
            token.recommendation.action === "strong_buy" && "border-emerald-500/30 bg-emerald-500/5",
            token.recommendation.action === "watch" && "border-amber-500/30 bg-amber-500/5",
            token.recommendation.action === "skip" && "border-rose-500/30 bg-rose-500/5",
            token.recommendation.action === "neutral" && "border-border bg-muted/30",
          )}>
            <BuyRecommendationPill rec={token.recommendation} />
            {token.bonding && <BondingBadge bonding={token.bonding} />}
          </div>
        )}
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 rounded-full border border-border">
            {token.logo_url ? (
              <img src={token.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-violet-200">
                {token.symbol?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold">{token.symbol || "—"}</h3>
              {token.ageSeconds > 0 && token.ageSeconds < 24 * 3600 && (
                <Badge className="bg-violet-500/15 text-violet-200 border-violet-500/30">
                  <Flame className="mr-1 h-2.5 w-2.5" /> New
                </Badge>
              )}
              {verdict && <VerdictBadge verdict={verdict} className="hidden sm:inline-flex" />}
            </div>
            <p className="truncate text-xs text-muted-foreground" title={token.name}>{token.name}</p>
          </div>

          <RunnerScoreRing score={token.runnerScore} grade={token.runnerGrade} size={48} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Contract address — always copyable, prominent */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="mono truncate text-[11px] text-muted-foreground sm:text-xs">{token.token}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <CopyButton value={token.token} label="contract address" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onStar}
              aria-label={star ? "Remove from watchlist" : "Add to watchlist"}
              title={star ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star className={cn("h-3.5 w-3.5", star ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={Droplets} label="Liquidity" value={fmtUsd(liq)} hint="Ave.ai main-pair TVL — liquidity guardrail" />
          <Metric icon={TrendingUp} label="Mkt cap" value={fmtUsd(mcap)} hint="FDV × price" />
          <Metric icon={Users} label="Holders" value={fmtNum(holders)} />
          <Metric icon={Clock} label="Age" value={token.ageLabel} />
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">1h</span>
              <ChangePill value={pct1h} label="1h price change" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">24h</span>
              <ChangePill value={pct24h} label="24h price change" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Buyers (1h)</span>
              <span className="tabular-nums text-emerald-300">{fmtNum(buyers1h, false)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sellers (1h)</span>
              <span className="tabular-nums text-rose-300">{fmtNum(sellers1h, false)}</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-500/15 text-violet-200 border-violet-500/30">
              <TrendingUp className="mr-1 h-2.5 w-2.5" /> {token.potentialMultipleLabel}
            </Badge>
            <span className="text-[10px] text-muted-foreground">≈ headroom to $5M mcap</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="font-medium text-emerald-300">{safetyScore}</span>
            <span>safety</span>
            {criticalCount > 0 && <span className="ml-1 rounded bg-rose-500/15 px-1 text-rose-300">{criticalCount} critical</span>}
            {warningCount > 0 && <span className="ml-1 rounded bg-amber-500/15 px-1 text-amber-300">{warningCount} warn</span>}
          </div>
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center justify-end gap-1 text-[10px]">
            <a
              href={token.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              Explorer <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={token.aveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              Ave.ai <ExternalLink className="h-2.5 w-2.5" />
            </a>
            {token.socials.twitter && (
              <a
                href={token.socials.twitter}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
              >
                Twitter <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
