import { cn } from "@/lib/utils";
import type { BondingInfo } from "@/lib/types";
import { Flame, Rocket, Anchor, CheckCircle2 } from "lucide-react";

const STYLES: Record<BondingInfo["status"], { label: string; cls: string; icon: React.ElementType }> = {
  bonding: {
    label: "Bonding",
    cls: "border-violet-500/40 bg-violet-500/15 text-violet-200",
    icon: Flame,
  },
  early_liquidity: {
    label: "Early liquidity",
    cls: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200",
    icon: Rocket,
  },
  migrated: {
    label: "On DEX",
    cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    icon: Anchor,
  },
  established: {
    label: "Established",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    icon: CheckCircle2,
  },
};

interface BondingBadgeProps {
  bonding?: BondingInfo;
  className?: string;
}

// Surfaces the bonding status prominently. The label from detectBondingStatus
// already includes the progress % (e.g. "Bonding · 42%") so we don't append
// it again here.
export function BondingBadge({ bonding, className }: BondingBadgeProps) {
  if (!bonding) return null;
  const s = STYLES[bonding.status];
  const Icon = s.icon;
  const isEarly = bonding.status === "bonding" || bonding.status === "early_liquidity";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        s.cls,
        isEarly && "animate-pulse",
        className,
      )}
      title={bonding.detail}
    >
      <Icon className="h-3 w-3" />
      <span>{bonding.label}</span>
    </span>
  );
}
