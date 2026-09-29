"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw, Search } from "lucide-react";

export interface RunnerFilters {
  chain: string;
  minScore: number;        // 0..100
  minLiquidityUsd: number; // 0..N
  maxAgeHours: number;     // 0 => no cap
  requireSafe: boolean;   // hide tokens marked danger
  bondingOnly?: boolean;   // only tokens still bonding / in early liquidity
  strongBuyOnly?: boolean; // only tokens with strong_buy recommendation
  topic?: string;          // optional Ave.ai rank topic override
  keyword?: string;
}

interface FiltersBarProps {
  value: RunnerFilters;
  onChange: (next: RunnerFilters) => void;
  onRefresh: () => void;
  loading?: boolean;
  chains?: { chain: string; name: string }[];
  variant?: "full" | "compact";
}

const LIQ_OPTIONS = [
  { label: "All", value: 0 },
  { label: "$5k+", value: 5_000 },
  { label: "$25k+", value: 25_000 },
  { label: "$100k+", value: 100_000 },
];

const AGE_OPTIONS = [
  { label: "Any age", value: 0 },
  { label: "≤ 1h", value: 1 },
  { label: "≤ 6h", value: 6 },
  { label: "≤ 24h", value: 24 },
  { label: "≤ 72h", value: 72 },
  { label: "≤ 7d", value: 168 },
];

// Sticky filter bar at the top of the runners feed. Every control maps to a
// server-side filter applied by /api/runners so the heavy lifting is done in
// the route handler.
export function FiltersBar({ value, onChange, onRefresh, loading, chains, variant = "full" }: FiltersBarProps) {
  const set = <K extends keyof RunnerFilters>(k: K, v: RunnerFilters[K]) => onChange({ ...value, [k]: v });

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Runner filters</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{loading ? "Refreshing…" : "Refresh"}</span>
            <span className="sm:hidden">{loading ? "…" : "Refresh"}</span>
          </Button>
        </div>

        <div className={variant === "full" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-5" : "flex flex-wrap gap-2"}>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Chain</Label>
            <Select value={value.chain} onValueChange={(v) => set("chain", v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(chains ?? [{ chain: "eth", name: "Ethereum (Stockereum)" }]).map((c) => (
                  <SelectItem key={c.chain} value={c.chain} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Min liquidity</Label>
            <Select
              value={String(value.minLiquidityUsd)}
              onValueChange={(v) => set("minLiquidityUsd", Number(v))}
            >
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIQ_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Age cap</Label>
            <Select value={String(value.maxAgeHours)} onValueChange={(v) => set("maxAgeHours", Number(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Min runner score</Label>
              <span className="text-xs font-semibold tabular-nums text-emerald-300">{value.minScore}</span>
            </div>
            <Slider
              value={[value.minScore]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => set("minScore", v[0] ?? 0)}
              className="mt-2"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={value.requireSafe}
              onCheckedChange={(c) => set("requireSafe", c)}
            />
            <span>Hide tokens flagged <span className="text-rose-300">danger</span></span>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={!!value.bondingOnly}
              onCheckedChange={(c) => set("bondingOnly", c)}
            />
            <span>Only tokens still <span className="text-violet-300">bonding</span> / early liq</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={!!value.strongBuyOnly}
              onCheckedChange={(c) => set("strongBuyOnly", c)}
            />
            <span>Only <span className="text-emerald-300">strong buy</span> calls</span>
          </label>
        </div>

        {variant === "full" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={value.keyword ?? ""}
              onChange={(e) => set("keyword", e.target.value || undefined)}
              placeholder="Search by symbol or paste a CA…"
              className="h-9 pl-8 text-xs"
            />
          </div>
        )}
      </div>
    </Card>
  );
}
