// Number / currency / time formatting helpers for the dashboard.

export function fmtUsd(value: number | string | undefined | null, opts?: { compact?: boolean; decimals?: number }): string {
  const v = toNum(value);
  if (!isFinite(v)) return "—";
  const compact = opts?.compact ?? true;
  const decimals = opts?.decimals ?? (compact ? 2 : 6);
  if (compact) {
    if (Math.abs(v) >= 1) return usdCompact(v);
    // small prices: show up to 8 significant decimals
    const s = v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 8 });
    return s;
  }
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: decimals });
}

function usdCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

export function fmtPct(value: number | string | undefined | null, withSign = true): string {
  const v = toNum(value);
  if (!isFinite(v)) return "—";
  const sign = withSign && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export function fmtNum(value: number | string | undefined | null, compact = true): string {
  const v = toNum(value);
  if (!isFinite(v)) return "—";
  if (!compact) return v.toLocaleString("en-US");
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  if (abs >= 1) return v.toFixed(2);
  // tiny numbers — use scientific if extremely small
  if (abs > 0 && abs < 1e-6) return v.toExponential(2);
  return v.toFixed(4);
}

export function toNum(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function shortAddr(addr: string | undefined | null, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

// Convert unix-seconds epoch (Ave.ai style) into an age label like "3h 12m".
export function ageLabelFromUnixSec(unixSec: number | undefined | null, now: number = Date.now()): string {
  if (!unixSec && unixSec !== 0) return "—";
  const sec = Math.max(0, Math.floor(now / 1000) - unixSec);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function relativeTimeLabel(unixSec: number | undefined | null): string {
  if (!unixSec && unixSec !== 0) return "—";
  const date = new Date(unixSec * 1000);
  return date.toLocaleString();
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// 0..1 -> 0..100
export function pct(n: number): number {
  return Math.round(clamp(n, 0, 1) * 100);
}
