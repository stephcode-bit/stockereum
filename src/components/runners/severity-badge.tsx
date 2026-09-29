import { cn } from "@/lib/utils";
import type { RugSeverity } from "@/lib/types";

const STYLES: Record<RugSeverity, { label: string; cls: string; dot: string }> = {
  critical: {
    label: "Critical",
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
  },
  warning: {
    label: "Warning",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
  },
  info: {
    label: "Info",
    cls: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    dot: "bg-cyan-300",
  },
  ok: {
    label: "Safe",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
};

interface SeverityBadgeProps {
  severity: RugSeverity;
  label?: string;
  className?: string;
  withDot?: boolean;
}

// Re-usable pill for surfacing rug-check severities throughout the UI.
export function SeverityBadge({ severity, label, className, withDot = true }: SeverityBadgeProps) {
  const s = STYLES[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        s.cls,
        className,
      )}
    >
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {label || s.label}
    </span>
  );
}

// Verdict pill — larger, used in card headers and the detail drawer.
export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: "safe" | "caution" | "danger";
  className?: string;
}) {
  const map = {
    safe: { label: "Safe", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200", dot: "bg-emerald-400" },
    caution: { label: "Caution", cls: "border-amber-500/40 bg-amber-500/15 text-amber-200", dot: "bg-amber-400" },
    danger: { label: "Danger", cls: "border-rose-500/40 bg-rose-500/15 text-rose-200", dot: "bg-rose-400" },
  } as const;
  const s = map[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        s.cls,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
