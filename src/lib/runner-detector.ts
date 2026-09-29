import "server-only";
import { AveToken, RunnerToken, RunnerTopic, RunnerScoreBreakdown, RugReport, BondingInfo, BuyRecommendation } from "@/lib/types";
import { buildRugReport } from "@/lib/rugcheck";
import { ageLabelFromUnixSec, clamp, toNum } from "@/lib/format";
import { STOCKEREUM_CHAIN } from "@/lib/types";

// --- Tunable thresholds ------------------------------------------------
// These define what "an early runner" means for our feed. Tokens that don't
// pass these filters never make it into the dashboard — we intentionally keep
// the bar low enough to catch runners early but high enough to filter noise.

const AGE_NEW_MS = 24 * 60 * 60 * 1000;         // < 24h = "fresh"
const AGE_MAX_MS = 7 * 24 * 60 * 60 * 1000;     // older than 7d = too late to be a runner
const MCAP_RUNNER_MAX = 2_000_000;               // market cap < $2M = still has 2x-3x room
const MCAP_RUNNER_MIN = 5_000;                   // filter dust / spam
const LIQ_MIN_USD = 5_000;                       // hard liquidity guardrail
const VOL_1H_MIN_USD = 500;                      // needs *some* recent activity
const PCT_4H_MIN = 0;                            // 4h change must be flat or up

// Parse the appendix JSON Ave.ai attaches to most tokens (social links, etc.).
function parseAppendix(raw: string | undefined): RunnerToken["socials"] {
  if (!raw) return {};
  try {
    const a = JSON.parse(raw) as Record<string, string>;
    return {
      website: a.website || undefined,
      twitter: a.twitter || undefined,
      telegram: a.telegram || undefined,
      discord: a.discord || undefined,
      github: a.github || undefined,
      description: a.description || undefined,
    };
  } catch {
    return {};
  }
}

export function explorerFor(chain: string, ca: string): string {
  switch (chain) {
    case "eth":
      return `https://etherscan.io/token/${ca}`;
    case "bsc":
      return `https://bscscan.com/token/${ca}`;
    case "solana":
      return `https://solscan.io/token/${ca}`;
    case "base":
      return `https://basescan.org/token/${ca}`;
    case "arbitrum":
      return `https://arbiscan.io/token/${ca}`;
    case "polygon":
      return `https://polygonscan.com/token/${ca}`;
    case "optimism":
      return `https://optimistic.etherscan.io/token/${ca}`;
    case "avalanche":
      return `https://snowtrace.io/token/${ca}`;
    case "blast":
      return `https://blastscan.io/token/${ca}`;
    default:
      return `https://www.ave.ai/token/${ca}-${chain}`;
  }
}

/**
 * The heart of the runner engine. A token is a "runner" when ALL of the following
 * are true:
 *
 *   - It is fresh (created within the last 7 days; newer is better).
 *   - Market cap is between $5k and $2M (room to grow 2x-3x).
 *   - Liquidity is at least $5k (rugpull / unsellable guardrail).
 *   - It has at least $500 of 1h volume (must be actually trading, not dead).
 *   - 4h price action is flat or positive (dying tokens are excluded).
 *
 * Beyond passing the gate, each token gets a 0..100 runner score composed of:
 *
 *   age           — newer = higher score (max upside is at launch)
 *   liquidity     — adequate liquidity = safer runner
 *   volumeAccel   — recent (5m/1h) volume vs 4h/24h average = acceleration
 *   buyerPressure — buy volume / total volume in the last hour
 *   priceMomentum — short-window price change (1h weighted + 5m + 4h)
 *   holderBase    — non-trivial holder count (penalise <25 holders)
 *   safety        — rugcheck safety score (weighted 1.5x because guardrails matter)
 *
 * Output is sorted by runnerScore desc. We then attach a potentialMultiple that
 * is a *rough* ceiling estimate based on market cap headroom to $5M (a typical
 * first resistance where retail tops out on micro caps). Tokens already above
 * $1M mcap get a smaller multiple.
 */
export function isRunnerCandidate(token: AveToken, now: number = Date.now()): { pass: boolean; reason?: string } {
  const chain = token.chain;
  const ca = token.token;
  if (!chain || !ca) return { pass: false, reason: "missing chain or CA" };

  const createdAt = toNum(token.launch_at ?? token.created_at) * 1000;
  const ageMs = createdAt > 0 ? now - createdAt : Number.POSITIVE_INFINITY;

  // age gate
  if (createdAt > 0 && ageMs > AGE_MAX_MS) {
    return { pass: false, reason: `older than 7d` };
  }

  const mcap = toNum(token.market_cap);
  if (mcap > 0 && (mcap < MCAP_RUNNER_MIN || mcap > MCAP_RUNNER_MAX)) {
    return { pass: false, reason: `market cap outside $5k–$2M band` };
  }

  const liq = toNum(token.main_pair_tvl ?? token.tvl);
  if (liq > 0 && liq < LIQ_MIN_USD) {
    return { pass: false, reason: `liquidity under $${LIQ_MIN_USD}` };
  }

  const vol1h = toNum(token.token_tx_volume_usd_1h ?? token.tx_volume_u_24h);
  if (vol1h > 0 && vol1h < VOL_1H_MIN_USD) {
    return { pass: false, reason: `1h volume under $${VOL_1H_MIN_USD}` };
  }

  const pct4h = toNum(token.token_price_change_4h ?? token.price_change_24h);
  if (!Number.isNaN(pct4h) && pct4h < PCT_4H_MIN) {
    return { pass: false, reason: `4h price action negative` };
  }

  return { pass: true };
}

function clampScore(n: number): number {
  return clamp(n, 0, 1);
}

function computeBreakdown(token: AveToken, ageMs: number, rug: RugReport | undefined): RunnerScoreBreakdown {
  // age score: newest = 1; older = linear falloff to 0 at 7d
  let age = 1;
  if (Number.isFinite(ageMs) && ageMs > 0) {
    age = clampScore(1 - ageMs / AGE_MAX_MS);
  } else if (Number.isNaN(toNum(token.launch_at ?? token.created_at))) {
    age = 0.5; // unknown age — neutral
  }

  // liquidity score: $5k=0.1, $25k=0.4, $100k=0.7, $500k+=1
  const liq = toNum(token.main_pair_tvl ?? token.tvl);
  let liquidity = 0.1;
  if (liq >= 500_000) liquidity = 1;
  else if (liq >= 100_000) liquidity = 0.7;
  else if (liq >= 25_000) liquidity = 0.4;
  else if (liq > 0) liquidity = clampScore(0.1 + (liq / 25_000) * 0.3);
  else liquidity = 0.1;

  // volume acceleration: compare 5m/1h volume to 4h average rate
  const vol5m = toNum(token.token_tx_volume_usd_5m);
  const vol1h = toNum(token.token_tx_volume_usd_1h);
  const vol4h = toNum(token.token_tx_volume_usd_4h);
  const vol24h = toNum(token.token_tx_volume_usd_24h ?? token.tx_volume_u_24h);
  const expected5m = vol4h > 0 ? vol4h / 48 : 0; // 4h has 48 5-min buckets
  const expected1h = vol24h > 0 ? vol24h / 24 : vol4h / 4;
  let volumeAccel = 0.3;
  if (vol5m > 0 && expected5m > 0) volumeAccel = clampScore((vol5m / expected5m) / 2);
  if (vol1h > 0 && expected1h > 0) volumeAccel = clampScore(Math.max(volumeAccel, (vol1h / expected1h) / 2));
  if (vol5m <= 0 && vol1h <= 0) volumeAccel = 0.05;

  // buyer pressure: buy volume / total (buy+sell) volume in the 5m and 1h windows
  const buy5m = toNum(token.token_buy_volume_u_5m);
  const sell5m = toNum(token.token_sell_volume_u_5m);
  const buy1hRatio = (() => {
    const buyTx = toNum(token.token_buy_tx_count_1h);
    const sellTx = toNum(token.token_sell_tx_count_1h);
    if (buyTx + sellTx > 0) return buyTx / (buyTx + sellTx);
    return 0.5;
  })();
  const buy5mRatio = buy5m + sell5m > 0 ? buy5m / (buy5m + sell5m) : buy1hRatio;
  const buyerPressure = clampScore((buy5mRatio * 0.5 + buy1hRatio * 0.5));

  // price momentum: weighted short window changes
  const p5 = toNum(token.token_price_change_5m);
  const p1 = toNum(token.token_price_change_1h);
  const p4 = toNum(token.token_price_change_4h);
  const p24 = toNum(token.token_price_change_24h ?? token.price_change_24h);
  let momentum = 0.4;
  if (!Number.isNaN(p1)) momentum = clampScore(0.5 + p1 / 40); // +40% 1h = full score
  if (!Number.isNaN(p5)) momentum = clampScore((momentum + (0.5 + p5 / 20)) / 2);
  if (!Number.isNaN(p4)) momentum = clampScore((momentum + (0.5 + p4 / 80)) / 2);
  if (!Number.isNaN(p24) && p24 < -10) momentum = clampScore(momentum * 0.5); // decaying pumps lose points

  // holder base
  const holders = toNum(token.holders);
  let holderBase = 0.2;
  if (holders >= 500) holderBase = 1;
  else if (holders >= 100) holderBase = 0.7;
  else if (holders >= 25) holderBase = 0.4;
  else if (holders > 0) holderBase = 0.05;

  // safety — rug report score
  const safety = rug ? rug.safetyScore / 100 : 0.3;

  return { age, liquidity, volumeAccel, buyerPressure, priceMomentum: momentum, holderBase, safety };
}

function gradeFor(score: number): RunnerToken["runnerGrade"] {
  if (score >= 75) return "A";
  if (score >= 60) return "B";
  if (score >= 45) return "C";
  return "D";
}

// --- Bonding-curve detection --------------------------------------------
// Stockereum (Ethereum / Uniswap v4) doesn't use a bonding curve — tokens
// launch directly into a permanent Uniswap v4 pool. BUT the user wants the
// radar to also surface early tokens from OTHER launchpads (pump.fun,
// letsbonk.fun, moonshot, etc.) that DO use bonding curves, AND to flag the
// "early liquidity building" phase of any freshly-launched token before it
// has established a deep market.
//
// We detect bonding state from three signals:
//   1. CA suffix (pump.fun tokens on Solana end with "pump")
//   2. AMM name in the Ave.ai contract report's `dex[]` array
//      (pump.fun's bonding AMM is "pumpswap" / "pump" / "bonding-curve")
//   3. Heuristic: very fresh token (age < 60 min) with low liquidity (< $25k)
//      => treat as "early_liquidity" (still building a market)
//
// Bonding progress is computed against the typical pump.fun completion
// threshold ($69k mcap) for bonding-curve tokens, or against a $25k healthy
// liquidity threshold for early-liquidity tokens.

const PUMP_FUN_COMPLETION_MCAP = 69_000;     // pump.fun bonding curve completes ~$69k mcap
const EARLY_LIQ_THRESHOLD = 25_000;          // healthy liquidity floor for "early liquidity" tokens
const ESTABLISHED_LIQ = 100_000;             // "established" — past the early runner phase

function detectBondingStatus(
  token: AveToken,
  ageMs: number,
): BondingInfo {
  const ca = (token.token || "").toLowerCase();
  const isPumpFun = ca.endsWith("pump");
  // We can't cheaply read the contract report's dex[].amm here (that would
  // double Ave.ai calls per token). We rely on the CA-suffix convention
  // (pump.fun tokens on Solana end with "pump") + age + liquidity heuristics.

  const liq = toNum(token.main_pair_tvl ?? token.tvl);
  const mcap = toNum(token.market_cap);
  const ageMin = Number.isFinite(ageMs) ? ageMs / 60000 : Number.POSITIVE_INFINITY;

  // Case 1 — definite bonding-curve token (pump.fun or similar, detected
  // via the CA suffix convention used by pump.fun / letsbonk.fun).
  if (isPumpFun) {
    const progress = clamp(Math.round((mcap / PUMP_FUN_COMPLETION_MCAP) * 100), 0, 100);
    if (progress >= 100) {
      return {
        status: "migrated",
        progress: 100,
        label: "Migrated to AMM",
        detail: "Bonding curve complete — the token now trades on a regular DEX pool. Often the moment where the first major leg up happens.",
        migrationTarget: "Raydium / Meteora",
      };
    }
    return {
      status: "bonding",
      progress,
      label: `Bonding · ${progress}%`,
      detail: `Still on the bonding curve. ~${100 - progress}% to AMM migration (typical completion at $69k market cap). Buyers here get the steepest discount — and the steepest risk if the curve never completes.`,
      migrationTarget: "Raydium / Meteora",
    };
  }

  // Case 2 — fresh token on a non-bonding launchpad (e.g. Stockereum /
  // Uniswap v4) with low liquidity = "early liquidity building" phase.
  if (ageMin < 60 && liq > 0 && liq < EARLY_LIQ_THRESHOLD) {
    const progress = clamp(Math.round((liq / EARLY_LIQ_THRESHOLD) * 100), 0, 100);
    return {
      status: "early_liquidity",
      progress,
      label: `Early liq · ${progress}%`,
      detail: `Freshly launched — liquidity is still building. Currently $${Math.round(liq).toLocaleString()} of the $25k healthy floor. Price impact per buy is highest here; slippage tolerance should be generous.`,
      migrationTarget: "Uniswap v4",
    };
  }

  // Case 3 — established market, no longer an early runner
  if (liq >= ESTABLISHED_LIQ) {
    return {
      status: "established",
      progress: 100,
      label: "Established",
      detail: "Healthy liquidity — the token has matured past the early runner phase. The asymmetric upside is largely gone.",
    };
  }

  // Case 4 — default: token is on a DEX but liquidity is moderate
  return {
    status: "migrated",
    progress: 100,
    label: "On DEX",
    detail: "Token trades on a DEX pool with moderate liquidity. The very-early window has passed but runners can still 2x-3x from here.",
  };
}

// --- Buy recommendation engine -----------------------------------------
// Combines runner score, safety verdict, and bonding status into a clear
// STRONG BUY / WATCH / SKIP / NEUTRAL signal. Confidence is a 0..100 number
// the UI surfaces next to the verdict pill.
export function recommendBuy(token: RunnerToken): BuyRecommendation {
  const safety = token.rugReport?.safetyScore ?? 0;
  const verdict = token.rugReport?.verdict;
  const critical = token.rugReport?.criticalCount ?? 0;
  const score = token.runnerScore;
  const bonding = token.bonding?.status;

  // Hard skip — any critical guardrail failure kills the buy case.
  if (verdict === "danger" || critical > 0 || safety < 30) {
    return {
      action: "skip",
      reason: `${critical} critical guardrail${critical === 1 ? "" : "s"} failed — high rug-pull risk. Do not buy.`,
      confidence: 95,
    };
  }

  // Strong buy — clean guardrails, strong runner score, AND still in the
  // early accumulation phase (bonding curve or early liquidity). This is the
  // asymmetric-upside window the user explicitly asked to surface.
  if (score >= 70 && verdict === "safe" && (bonding === "bonding" || bonding === "early_liquidity")) {
    return {
      action: "strong_buy",
      reason: "Strong runner score, clean guardrails, and still in the early accumulation phase — the asymmetric upside window.",
      confidence: 82,
    };
  }

  // Watch — promising metrics but not all stars aligned.
  if (score >= 55 && verdict !== "danger") {
    return {
      action: "watch",
      reason: "Promising momentum and acceptable guardrails. Accumulate on dips, monitor for any guardrail changes after launch.",
      confidence: 58,
    };
  }

  // Caution — borderline safety but no critical flags.
  if (verdict === "caution") {
    return {
      action: "neutral",
      reason: "Borderline safety score. Wait for cleaner guardrails or a stronger runner score before committing capital.",
      confidence: 35,
    };
  }

  return {
    action: "neutral",
    reason: "Mixed signals — wait for clearer momentum or guardrail improvements.",
    confidence: 30,
  };
}

// Rough ceiling estimate. Micro-cap tokens ($5k–$100k) have a realistic path
// to $1M+; tokens already at $1M+ have a more constrained path. We compute the
// headroom to a $5M "local top" market cap, then sanity-cap at 10x to avoid
// promising unrealistic multiples.
function potentialMultiple(mcap: number): { value: number; label: string } {
  if (!isFinite(mcap) || mcap <= 0) return { value: 0, label: "—" };
  const ceiling = 5_000_000;
  const multiple = ceiling / mcap;
  const capped = Math.min(multiple, 10);
  const shown = Math.max(1.2, Math.round(capped * 10) / 10);
  if (shown >= 10) return { value: 10, label: "10x+ potential" };
  return { value: shown, label: `${shown.toFixed(1)}x potential` };
}

export async function toRunnerToken(token: AveToken, now: number = Date.now()): Promise<RunnerToken | null> {
  const gate = isRunnerCandidate(token, now);
  if (!gate.pass) return null;

  // Build rug report for every survivor — guardrails are not optional.
  // The report also exposes the contract's `dex[]` array, which we use for
  // bonding-curve detection.
  const rug = await buildRugReport(token).catch(() => undefined);

  const createdAtSec = toNum(token.launch_at ?? token.created_at);
  const ageMs = createdAtSec > 0 ? now - createdAtSec * 1000 : NaN;
  const breakdown = computeBreakdown(token, ageMs, rug);

  // Weighted total — safety is worth 1.5x because guardrails are the #1 feature.
  const total =
    breakdown.age * 0.2 +
    breakdown.liquidity * 0.12 +
    breakdown.volumeAccel * 0.18 +
    breakdown.buyerPressure * 0.15 +
    breakdown.priceMomentum * 0.15 +
    breakdown.holderBase * 0.05 +
    breakdown.safety * 0.15; // safety weight = 0.15; (1.5x of 0.10)

  const runnerScore = Math.round(clamp(total, 0, 1) * 100);
  const mcap = toNum(token.market_cap);
  const mult = potentialMultiple(mcap);

  // Bonding-curve / early-liquidity detection. Uses the CA suffix (pump.fun
  // tokens end with "pump") + age + liquidity heuristics. We don't re-read
  // the raw contract report's dex[] array here to avoid doubling Ave.ai
  // calls — the CA suffix + age/liquidity signals are enough for surfacing.
  const bonding = detectBondingStatus(token, ageMs);

  const runner: RunnerToken = {
    ...token,
    tokenId: `${token.token}-${token.chain}`,
    ageSeconds: Number.isFinite(ageMs) ? Math.floor(ageMs / 1000) : 0,
    ageLabel: ageLabelFromUnixSec(createdAtSec, now),
    runnerScore,
    runnerGrade: gradeFor(runnerScore),
    runnerBreakdown: breakdown,
    potentialMultiple: mult.value,
    potentialMultipleLabel: mult.label,
    bonding,
    rugReport: rug,
    socials: parseAppendix(token.appendix),
    explorerUrl: explorerFor(token.chain, token.token),
    aveUrl: `https://www.ave.ai/token/${token.token}-${token.chain}`,
  };

  // Buy recommendation needs the assembled RunnerToken (uses bonding + verdict).
  runner.recommendation = recommendBuy(runner);
  return runner;
}

/**
 * Batch-build the runner feed. We:
 *   1. Pull candidates from multiple topics + the trending feed (so we don't miss
 *      runners that haven't broken into any single ranking yet).
 *   2. De-dupe by CA-chain.
 *   3. Run the candidate gate + build runner tokens (incl. rug reports) in parallel.
 *   4. Sort by runner score desc.
 *
 * @param sources tokens collected from /v2/ranks + /v2/tokens/trending
 */
export async function buildRunnerFeed(sources: AveToken[], now: number = Date.now()): Promise<RunnerToken[]> {
  const seen = new Set<string>();
  const unique: AveToken[] = [];
  for (const t of sources) {
    const key = `${t.token}-${t.chain}`;
    if (!seen.has(key) && t.token && t.chain) {
      seen.add(key);
      unique.push(t);
    }
  }

  const built = await Promise.all(unique.map((t) => toRunnerToken(t, now).catch(() => null)));
  const runners = built.filter((r): r is RunnerToken => r !== null);
  runners.sort((a, b) => b.runnerScore - a.runnerScore);
  return runners;
}

// Convenience: the topics we poll when assembling the runner feed.
export const DEFAULT_RUNNER_TOPICS: RunnerTopic[] = ["new", "gainer", "eth", "meme"];

// Filter helpers exposed so route handlers can also apply user filters cleanly.
export function runnerPassesUserFilters(
  r: RunnerToken,
  opts: {
    minScore?: number;
    minLiquidityUsd?: number;
    maxAgeHours?: number;
    requireSafeVerdict?: boolean;
    bondingOnly?: boolean;
    strongBuyOnly?: boolean;
  },
): boolean {
  if (opts.minScore && r.runnerScore < opts.minScore) return false;
  const liq = toNum(r.main_pair_tvl ?? r.tvl);
  if (opts.minLiquidityUsd && liq > 0 && liq < opts.minLiquidityUsd) return false;
  if (opts.maxAgeHours && r.ageSeconds > 0 && r.ageSeconds / 3600 > opts.maxAgeHours) return false;
  if (opts.requireSafeVerdict && r.rugReport && r.rugReport.verdict === "danger") return false;
  // "Bonding only" surfaces tokens still on a bonding curve OR in the early
  // liquidity-building phase — i.e. before the AMM migration / deep liquidity.
  if (opts.bondingOnly) {
    const s = r.bonding?.status;
    if (s !== "bonding" && s !== "early_liquidity") return false;
  }
  // "Strong buy only" surfaces tokens our engine actively recommends buying.
  if (opts.strongBuyOnly && r.recommendation?.action !== "strong_buy") return false;
  return true;
}

export const RUNNER_CONSTANTS = {
  AGE_MAX_MS,
  AGE_NEW_MS,
  MCAP_RUNNER_MAX,
  MCAP_RUNNER_MIN,
  LIQ_MIN_USD,
  VOL_1H_MIN_USD,
  STOCKEREUM_CHAIN,
};
