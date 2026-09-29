import { cn } from "@/lib/utils";

interface RunnerScoreRingProps {
  score: number;       // 0..100
  grade?: "A" | "B" | "C" | "D";
  size?: number;        // pixels
  className?: string;
  label?: string;
}

// Circular gauge used to display the 0..100 runner score on each card.
// We render a stroke-dashoffset circle so no charting lib is needed.
export function RunnerScoreRing({ score, grade, size = 56, className, label }: RunnerScoreRingProps) {
  const safe = Math.max(0, Math.min(100, score));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (safe / 100) * c;
  const stroke =
    safe >= 75 ? "stroke-emerald-400" : safe >= 60 ? "stroke-lime-400" : safe >= 45 ? "stroke-amber-400" : "stroke-rose-400";
  const textColor =
    safe >= 75 ? "text-emerald-300" : safe >= 60 ? "text-lime-300" : safe >= 45 ? "text-amber-300" : "text-rose-300";
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Runner score ${safe} of 100${grade ? `, grade ${grade}` : ""}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-base font-bold leading-none", textColor)}>{safe}</span>
        {grade && <span className="text-[9px] uppercase tracking-wide text-muted-foreground">grade {grade}</span>}
        {label && <span className="text-[9px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
