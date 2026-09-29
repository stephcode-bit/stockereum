import { cn } from "@/lib/utils";
import type { BuyRecommendation } from "@/lib/types";
import { CheckCircle2, Eye, XCircle, MinusCircle } from "lucide-react";

const STYLES: Record<BuyRecommendation["action"], { label: string; cls: string; icon: React.ElementType }> = {
  strong_buy: {
    label: "Strong Buy",
    cls: "border-emerald-500/50 bg-emerald-500/20 text-emerald-200 shadow-emerald-500/20",
    icon: CheckCircle2,
  },
  watch: {
    label: "Watch",
    cls: "border-amber-500/50 bg-amber-500/20 text-amber-200 shadow-amber-500/20",
    icon: Eye,
  },
  skip: {
    label: "Skip",
    cls: "border-rose-500/50 bg-rose-500/20 text-rose-200 shadow-rose-500/20",
    icon: XCircle,
  },
  neutral: {
    label: "Neutral",
    cls: "border-muted-foreground/40 bg-muted/30 text-muted-foreground",
    icon: MinusCircle,
  },
};

interface BuyRecommendationPillProps {
  rec?: BuyRecommendation;
  className?: string;
  size?: "sm" | "md";
}

// Big, prominent verdict pill for the buy/skip recommendation. Used at the top
// of every token card so users can scan the feed and instantly know what to do.
export function BuyRecommendationPill({ rec, className, size = "sm" }: BuyRecommendationPillProps) {
  if (!rec) return null;
  const s = STYLES[rec.action];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wide shadow-sm",
        size === "sm" ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        s.cls,
        className,
      )}
      title={`${rec.reason} (confidence: ${rec.confidence}%)`}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span>{s.label}</span>
      <span className="ml-0.5 opacity-70">{rec.confidence}%</span>
    </span>
  );
}
