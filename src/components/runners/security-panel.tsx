"use client";

import { Separator } from "@/components/ui/separator";
import { SeverityBadge, VerdictBadge } from "./severity-badge";
import { cn } from "@/lib/utils";
import type { RugReport } from "@/lib/types";
import { ShieldCheck, ShieldAlert, ShieldX, Info } from "lucide-react";
import { fmtNum, toNum } from "@/lib/format";

interface SecurityPanelProps {
  report?: RugReport;
  className?: string;
}

// Surfaces EVERY rugcheck guardrail as a list item, grouped by severity.
// We deliberately show all checks — users asked for "guardrails against
// rugpull, low liquidity, unlocked tokens and many more" — hiding nothing.
export function SecurityPanel({ report, className }: SecurityPanelProps) {
  if (!report) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground", className)}>
        Risk report unavailable. Treat this token as unverified.
      </div>
    );
  }

  const order = ["critical", "warning", "info", "ok"] as const;
  const checks = [...report.checks].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  const Icon =
    report.verdict === "safe" ? ShieldCheck : report.verdict === "caution" ? ShieldAlert : ShieldX;
  const iconCls =
    report.verdict === "safe"
      ? "text-emerald-400"
      : report.verdict === "caution"
        ? "text-amber-400"
        : "text-rose-400";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-3">
        <div className="flex items-center gap-3">
          <Icon className={cn("h-7 w-7", iconCls)} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Safety score</span>
              <VerdictBadge verdict={report.verdict} />
            </div>
            <p className="text-xs text-muted-foreground">
              {report.criticalCount} critical · {report.warningCount} warnings · {report.okCount} ok
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{report.safetyScore}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">/ 100</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {checks.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex flex-col gap-1 rounded-md border border-border/60 bg-card/40 p-2.5",
              c.severity === "critical" && "border-rose-500/30 bg-rose-500/5",
              c.severity === "warning" && "border-amber-500/30 bg-amber-500/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={c.severity} />
                <span className="text-xs font-medium">{c.label}</span>
              </div>
              {typeof c.value === "number" && c.value > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">{fmtNum(c.value)}</span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{c.detail}</p>
          </div>
        ))}
      </div>

      <Separator />

      <div className="flex items-start gap-2 rounded-md bg-cyan-500/5 p-2.5 text-[11px] text-cyan-100/80">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Guardrails are computed from Ave.ai&rsquo;s Contract Risk Detection Report
          (<span className="mono">/v2/contracts/&lbrace;token-id&rbrace;</span>). A token can still
          rug despite a clean report — never invest more than you can lose. Combine
          the safety score with on-chain intuition before acting.
        </p>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Fetched {new Date(report.fetchedAt).toLocaleString()} · {toNum(report.checks.length)} checks
      </p>
    </div>
  );
}
