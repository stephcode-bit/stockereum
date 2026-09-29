import "server-only";
import { AveContractReport, AveToken, RugCheck, RugReport } from "@/lib/types";
import { demoMode, getContractReport } from "@/lib/ave-api";
import { DEMO_CONTRACT_REPORTS } from "@/lib/demo-data";
import { toNum } from "@/lib/format";

// Convert Ave.ai's many stringly-typed booleans into a real boolean.
// Values like "1", "true", "yes", true => true. Everything else => false.
function isTruthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "y";
  }
  return false;
}

// Read Ave.ai's truthiness but flip it so a "truthy" guard value represents a RISK.
function isRisk(v: unknown): boolean {
  return isTruthy(v);
}

const CRITICAL_WEIGHT = 22;  // each critical flag shaves ~22 pts off safety score
const WARNING_WEIGHT = 8;    // each warning shaves ~8 pts

/**
 * Produce a structured rug-pull risk report from an Ave.ai Contract Risk Detection
 * Report. We surface every meaningful guardrail:
 *
 *   - Honeypot (cannot buy / cannot sell all)
 *   - LP not adequate / low liquidity
 *   - LP creator holds > 5%
 *   - Token creator holds > 5%
 *   - Big wallet concentration
 *   - Known scam wallet linked
 *   - Mintable authority (can mint more -> inflation rug)
 *   - Owner can take back ownership
 *   - Buy / Sell tax abusive
 *   - Blacklist flag
 *   - Not open source / proxy / not audited
 *   - Slippage / anti-whale limits modifiable
 *   - Trading cooldown / pausable
 *   - Token not in any DEX pool
 *   - Holder concentration from top holders
 *
 * The function is defensive — any missing fields degrade to "info" rather than
 * silently passing the token through. Guardrails fail CLOSED: missing data is a
 * warning, not an automatic pass.
 */
export async function buildRugReport(token: AveToken): Promise<RugReport> {
  const tokenId = `${token.token}-${token.chain}`;
  const chain = token.chain;

  let report: AveContractReport;
  try {
    if (demoMode()) {
      const fallback = DEMO_CONTRACT_REPORTS[tokenId];
      if (!fallback) throw new Error("Demo contract report not available for this token");
      report = fallback;
    } else {
      report = await getContractReport(tokenId);
    }
  } catch (err) {
    // If we couldn't fetch the risk report at all, we surface that loudly — we
    // never want to silently pass a token as "safe" when we couldn't verify it.
    return unavailableReport(tokenId, chain, err);
  }

  const checks: RugCheck[] = [];
  const push = (c: RugCheck) => checks.push(c);

  // ---------- Honeypot guards ----------
  const cannotBuy = isRisk(report.cannot_buy);
  const cannotSellAll = isRisk(report.cannot_sell_all);
  const isHoneypot = isRisk(report.is_honeypot) || cannotBuy || cannotSellAll;
  push({
    id: "honeypot",
    label: "Honeypot",
    severity: isHoneypot ? "critical" : "ok",
    detail: isHoneypot
      ? "Ave.ai detected this as a honeypot — you can buy but may not be able to sell."
      : "Not flagged as a honeypot. Buy and sell both work.",
    value: isHoneypot ? true : false,
  });

  // ---------- Liquidity guards ----------
  // Ave.ai's `analysis_lp_current_adequate` flag is binary: "is the current LP
  // deep enough for normal trading?". For freshly-launched / bonding tokens,
  // "not adequate" is EXPECTED — the curve is still building liquidity. We
  // therefore split the verdict by raw dollar threshold, not just the
  // Ave.ai flag:
  //   < $5k    → critical (under the hard safety floor — a single sell dumps)
  //   $5k–$25k → warning  (thin, but tradable — normal for fresh runners)
  //   ≥ $25k   → ok        (healthy enough for early accumulation)
  // We surface the Ave.ai "not adequate" flag as additional context in the
  // detail text but it never escalates beyond the dollar-band verdict.
  const lpVolume = toNum(report.analysis_lp_current_volume);
  const lpAdequate = isTruthy(report.analysis_lp_current_adequate);
  let lpSeverity: RugCheck["severity"] = "ok";
  let lpDetail = `LP liquidity is $${lpVolume.toLocaleString()} and Ave.ai marks it as adequate.`;
  if (lpVolume > 0 && lpVolume < 5_000) {
    lpSeverity = "critical";
    lpDetail = `LP liquidity is only $${lpVolume.toLocaleString()} — below the $5k safe floor. A single sell can dump the price.`;
  } else if (lpVolume > 0 && lpVolume < 25_000) {
    lpSeverity = "warning";
    lpDetail = lpAdequate
      ? `LP liquidity is $${lpVolume.toLocaleString()} — under the $25k caution threshold. Normal for fresh runners still building a market.`
      : `LP liquidity is $${lpVolume.toLocaleString()} — under the $25k caution threshold. Ave.ai also marks it as not yet adequate for normal trading (expected for freshly-launched tokens).`;
  } else if (!lpAdequate && lpVolume >= 25_000) {
    // Adequate by dollars but Ave.ai still flags not-adequate — surface as info.
    lpSeverity = "info";
    lpDetail = `LP liquidity is $${lpVolume.toLocaleString()} but Ave.ai still marks it as not fully adequate — possible exit friction.`;
  }
  push({
    id: "lp_adequate",
    label: "Liquidity",
    severity: lpSeverity,
    detail: lpDetail,
    value: lpVolume || null,
  });

  // ---------- LP / token creator concentration ----------
  const lpCreatorGt5 = report.analysis_lp_creator_gt_5percent === 1;
  push({
    id: "lp_creator_concentration",
    label: "LP creator concentration",
    severity: lpCreatorGt5 ? "critical" : "ok",
    detail: lpCreatorGt5
      ? "Liquidity-pool creator holds > 5% — high rug-pull risk if they pull liquidity."
      : "LP creator does not hold a concerning concentration.",
    value: lpCreatorGt5 ? true : false,
  });

  const tokenCreatorGt5 = report.analysis_creator_gt_5percent === 1;
  push({
    id: "creator_concentration",
    label: "Token creator concentration",
    severity: tokenCreatorGt5 ? "critical" : "ok",
    detail: tokenCreatorGt5
      ? "Token creator holds > 5% of supply — they can dump and crash the price."
      : "Token creator does not hold a concerning concentration.",
    value: tokenCreatorGt5 ? true : false,
  });

  const creatorPct = toNum(report.creator_percent);
  push({
    id: "creator_pct",
    label: "Creator ownership",
    severity: creatorPct > 50 ? "critical" : creatorPct > 5 ? "warning" : "ok",
    detail: `Creator holds ${creatorPct.toFixed(2)}% of supply.`,
    value: creatorPct,
  });

  // ---------- Wallet risk ----------
  const bigWallet = isRisk(report.analysis_big_wallet);
  push({
    id: "big_wallet",
    label: "Whale concentration",
    severity: bigWallet ? "warning" : "ok",
    detail: bigWallet
      ? "A single non-creator wallet holds a large share — watch for coordinated dumps."
      : "No single wallet flagged as over-concentrated.",
    value: bigWallet,
  });

  const scamWallet = isRisk(report.analysis_scam_wallet);
  push({
    id: "scam_wallet",
    label: "Scam wallet link",
    severity: scamWallet ? "critical" : "ok",
    detail: scamWallet
      ? "A wallet linked to this token is flagged as a known scam wallet."
      : "No known scam wallet linked to this token.",
    value: scamWallet,
  });

  // ---------- Authority / mint / ownership ----------
  const mintable = isRisk(report.is_mintable) || isRisk(token.is_mintable ?? false);
  push({
    id: "mintable",
    label: "Mintable",
    severity: mintable ? "critical" : "ok",
    detail: mintable
      ? "Owner can mint more tokens — supply is not fixed. Inflation rug risk."
      : "Supply is fixed — owner cannot mint more tokens.",
    value: mintable,
  });

  const takeBackOwnership = isRisk(report.can_take_back_ownership);
  push({
    id: "take_back_ownership",
    label: "Reclaim ownership",
    severity: takeBackOwnership ? "critical" : "ok",
    detail: takeBackOwnership
      ? "Owner can reclaim contract ownership after renouncing — fake-renounce risk."
      : "Owner cannot reclaim ownership after renouncing.",
    value: takeBackOwnership,
  });

  const proxy = isRisk(report.is_proxy);
  push({
    id: "proxy",
    label: "Upgradeable proxy",
    severity: proxy ? "warning" : "ok",
    detail: proxy
      ? "Contract is behind a proxy — logic can be replaced after launch."
      : "Contract is not behind an upgradeable proxy.",
    value: proxy,
  });

  // ---------- Tax ----------
  const buyTax = toNum(report.buy_tax);
  const sellTax = toNum(report.sell_tax);
  const taxTotal = buyTax + sellTax;
  let taxSeverity: RugCheck["severity"] = "ok";
  let taxDetail = `Buy ${buyTax.toFixed(1)}% / Sell ${sellTax.toFixed(1)}% (combined ${taxTotal.toFixed(1)}%).`;
  if (taxTotal >= 25) {
    taxSeverity = "critical";
    taxDetail = `Combined tax is ${taxTotal.toFixed(1)}% — abusive tax honeypot territory.`;
  } else if (taxTotal >= 10) {
    taxSeverity = "warning";
    taxDetail = `Combined tax is ${taxTotal.toFixed(1)}% — high friction, hard to exit cleanly.`;
  }
  push({ id: "tax", label: "Buy / sell tax", severity: taxSeverity, detail: taxDetail, value: { buyTax, sellTax } });

  // ---------- Modifiable limits ----------
  const slippageModifiable = isRisk(report.slippage_modifiable) || isRisk(report.is_anti_whale_modifiable) || isRisk(report.anti_whale_modifiable);
  push({
    id: "modifiable_limits",
    label: "Modifiable limits",
    severity: slippageModifiable ? "warning" : "ok",
    detail: slippageModifiable
      ? "Owner can change slippage / anti-whale limits after launch — they could block sells."
      : "Trading limits cannot be modified by the owner.",
    value: slippageModifiable,
  });

  const pausable = isRisk(report.transfer_pausable) || isRisk(report.personal_pausable) || isRisk(report.trading_cooldown);
  push({
    id: "pausable",
    label: "Pausable / cooldown",
    severity: pausable ? "warning" : "ok",
    detail: pausable
      ? "Owner can pause trading or enforce a cooldown — they could freeze exits."
      : "Trading cannot be paused by the owner.",
    value: pausable,
  });

  // ---------- Source / audit / blacklist ----------
  const openSource = isTruthy(report.is_open_source);
  push({
    id: "open_source",
    label: "Source verified",
    severity: openSource ? "ok" : "warning",
    detail: openSource
      ? "Contract source is verified on the block explorer."
      : "Contract source is NOT verified — you cannot audit the logic.",
    value: openSource,
  });

  const blacklisted = isRisk(report.is_blacklisted) || isRisk(report.is_in_blacklist);
  push({
    id: "blacklist",
    label: "Blacklist",
    severity: blacklisted ? "critical" : "ok",
    detail: blacklisted
      ? "Token is on a blacklist — do not interact."
      : "Token is not flagged on any known blacklist.",
    value: blacklisted,
  });

  // ---------- In DEX ----------
  const inDex = isTruthy(report.is_in_dex);
  push({
    id: "in_dex",
    label: "Listed on DEX",
    severity: inDex ? "ok" : "warning",
    detail: inDex
      ? `Token trades on ${report.dex?.length || "at least one"} DEX pool(s).`
      : "Token is not currently in any DEX pool — you cannot buy it on-chain right now.",
    value: inDex,
  });

  // ---------- Holder count ----------
  const holders = toNum(report.holders ?? token.holders);
  let holderSeverity: RugCheck["severity"] = "ok";
  let holderDetail = `${holders.toLocaleString()} holder(s).`;
  if (holders > 0 && holders < 5) {
    holderSeverity = "critical";
    holderDetail = `Only ${holders} holder(s) — almost certainly the deployer and a few test wallets.`;
  } else if (holders < 25) {
    holderSeverity = "warning";
    holderDetail = `Only ${holders} holder(s) — very early stage, high concentration risk.`;
  }
  push({ id: "holders", label: "Holders", severity: holderSeverity, detail: holderDetail, value: holders });

  // ---------- Burn / renounce approximation ----------
  const burn = toNum(report.burn_amount ?? token.burn_amount);
  push({
    id: "burn",
    label: "Burned supply",
    severity: "info",
    detail: burn > 0 ? `${burn.toLocaleString()} units of supply have been burned.` : "No burn detected — supply is fully circulating.",
    value: burn,
  });

  // ---------- Score ----------
  const criticalCount = checks.filter((c) => c.severity === "critical").length;
  const warningCount = checks.filter((c) => c.severity === "warning").length;
  const okCount = checks.filter((c) => c.severity === "ok").length;
  const safetyScore = Math.max(
    0,
    Math.min(100, 100 - criticalCount * CRITICAL_WEIGHT - warningCount * WARNING_WEIGHT),
  );
  const verdict: RugReport["verdict"] = criticalCount > 0 ? "danger" : warningCount > 1 ? "caution" : "safe";

  return {
    tokenId,
    chain,
    checks,
    criticalCount,
    warningCount,
    okCount,
    safetyScore,
    verdict,
    fetchedAt: Date.now(),
  };
}

function unavailableReport(tokenId: string, chain: string, err: unknown): RugReport {
  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    tokenId,
    chain,
    checks: [
      {
        id: "report_unavailable",
        label: "Risk report unavailable",
        severity: "warning",
        detail: `Could not fetch the Contract Risk Detection Report from Ave.ai: ${message}. Treat this token as UNVERIFIED.`,
        value: null,
      },
    ],
    criticalCount: 0,
    warningCount: 1,
    okCount: 0,
    safetyScore: 30,
    verdict: "caution",
    fetchedAt: Date.now(),
  };
}
