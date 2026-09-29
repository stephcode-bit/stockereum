// Canonical chain identifier for the Stockereum launchpad ecosystem.
// Stockereum.fun -> stockereum.com is a Uniswap v4 launchpad deployed on Ethereum,
// so the "Stockereum chain" maps to ave.ai's `eth` chain name.
export const STOCKEREUM_CHAIN = "eth" as const;

// Default topics surfaced by Ave.ai's /v2/ranks/topics endpoint that are most useful
// for finding EARLY runners (not just trending/hot pumps that have already happened).
export const RUNNER_TOPICS = ["new", "gainer", "eth", "meme"] as const;
export type RunnerTopic = (typeof RUNNER_TOPICS)[number];

export interface AveToken {
  token: string;            // contract address (CA)
  chain: string;            // e.g. "eth", "solana", "bsc"
  name: string;
  symbol: string;
  decimal: number;
  total?: string;           // total supply (raw)
  // price
  current_price_usd?: string;
  current_price_eth?: string;
  launch_price?: string;
  price_change_1d?: string;
  price_change_24h?: string;
  // granular price change used for runner detection
  token_price_change_5m?: string;
  token_price_change_1h?: string;
  token_price_change_4h?: string;
  token_price_change_24h?: string;
  // market data
  market_cap?: string;
  fdv?: string;
  tvl?: string;
  main_pair_tvl?: string;
  main_pair?: string;
  // volume (multi-window)
  token_tx_volume_usd_5m?: string;
  token_tx_volume_usd_1h?: string;
  token_tx_volume_usd_4h?: string;
  token_tx_volume_usd_24h?: string;
  tx_volume_u_24h?: string;
  // buy / sell volume breakdowns
  token_buy_volume_u_5m?: string;
  token_sell_volume_u_5m?: string;
  // tx + maker counts
  token_tx_count_5m?: number;
  token_tx_count_1h?: number;
  token_tx_count_4h?: number;
  token_tx_count_24h?: number;
  token_buy_tx_count_5m?: number;
  token_buy_tx_count_1h?: number;
  token_buy_tx_count_4h?: number;
  token_buy_tx_count_24h?: number;
  token_sell_tx_count_5m?: number;
  token_sell_tx_count_1h?: number;
  token_sell_tx_count_4h?: number;
  token_sell_tx_count_24h?: number;
  token_buyers_5m?: number;
  token_buyers_1h?: number;
  token_buyers_4h?: number;
  token_buyers_24h?: number;
  token_sellers_5m?: number;
  token_sellers_1h?: number;
  token_sellers_4h?: number;
  token_sellers_24h?: number;
  token_makers_5m?: number;
  token_makers_1h?: number;
  token_makers_4h?: number;
  token_makers_24h?: number;
  // holders + liquidity lock info
  holders?: number;
  lock_amount?: string;
  burn_amount?: string;
  other_amount?: string;
  locked_percent?: string;
  lock_platform?: string;
  // timing
  launch_at?: number;       // unix seconds
  created_at?: number;     // unix seconds
  updated_at?: number;
  // social + metadata (appendix is a JSON string)
  appendix?: string;
  intro_en?: string;
  logo_url?: string;
  risk_level?: number;
  risk_score?: string;
  risk_info?: string;
  // DEPRECATED by Ave.ai in token responses — use Contract Risk Detection Report instead.
  // Still surfaced here for completeness, but NOT used for our guardrails.
  is_mintable?: string;
  has_mint_method?: boolean;
  is_lp_not_locked?: boolean;
  has_not_renounced?: boolean;
  has_not_audited?: boolean;
  has_not_open_source?: boolean;
  is_in_blacklist?: boolean;
  is_honeypot?: boolean;
  ave_risk_level?: number;
}

// Subset of the Contract Risk Detection Report (`/v2/contracts/{token-id}`) that we use
// for guardrails. Ave.ai returns many more fields; we only type the ones we read.
export interface AveContractReport {
  chain?: string;
  decimal?: string;
  creator_address?: string;
  creator_balance?: string;
  creator_percent?: string;
  creator_tx?: string;
  burn_amount?: number | string;
  buy_tax?: number | string;
  sell_tax?: number | string;
  buy_gas?: string;
  sell_gas?: string;
  approve_gas?: string;
  // rug-pull / honeypot guards
  cannot_buy?: string | number;       // "1" => users cannot buy  -> honeypot
  cannot_sell_all?: string | number; // "1" => cannot sell all   -> honeypot
  can_take_back_ownership?: string | number; // "1" => owner can reclaim -> rug risk
  anti_whale_modifiable?: string | number;   // "1" => whale limits can be changed
  // liquidity adequacy
  analysis_lp_current_adequate?: string;     // "1" => LP liquidity is adequate
  analysis_lp_current_volume?: string | number; // current LP USD liquidity
  analysis_lp_creator_gt_5percent?: number;  // 1 => LP creator holds >5% (rug risk)
  analysis_creator_gt_5percent?: number;     // 1 => token creator holds >5% (rug risk)
  analysis_big_wallet?: string;              // "1" => a single wallet holds too much
  analysis_scam_wallet?: string;             // "1" => known scam wallet linked
  // DEX pools where this token trades
  dex?: Array<{
    amm?: string;
    liquidity?: string | number;
    name?: string;
    pair?: string;
  }>;
  // open source / renounce / audit flags (authentic risk flags from contract report)
  is_open_source?: string | boolean;
  is_proxy?: string | boolean;
  is_mintable?: string | boolean;
  is_in_blacklist?: string | boolean;
  is_honeypot?: string | boolean;
  is_anti_whale?: string | boolean;
  is_in_dex?: string | boolean;
  is_whitelisted?: string | boolean;
  is_blacklisted?: string | boolean;
  holders?: number | string;
  total_supply?: string | number;
  transfer_pausable?: string | boolean;
  // additional tax information
  transfer_tax?: number | string;
  slippage_modifiable?: string | boolean;
  is_anti_whale_modifiable?: string | boolean;
  personal_pausable?: string | boolean;
  trading_cooldown?: string | boolean;
  personal_slippage_modifiable?: string | boolean;
  cannot_sell_all_honeypot?: string | boolean;
}

export interface AveListResponse<T = unknown> {
  status: number; // 1 = success, 2 = error
  msg: string;
  data_type?: number;
  data?: T;
}

export interface AveTrendingResponse {
  current_page_size?: number;
  next_page?: number;
  total?: number;
  tokens?: AveToken[];
}

export interface AveSupportedChain {
  chain_id: string;
  name: string;
  chain: string;
  description?: string;
  rpc_url?: string;
  block_explorer_url?: string;
  case_sensitive?: boolean;
  only_native_coin?: boolean;
}

// --- Derived domain types produced by our runner/rugcheck engines ---

export type RugSeverity = "critical" | "warning" | "info" | "ok";

export interface RugCheck {
  id: string;            // stable machine id, e.g. "honeypot"
  label: string;         // human label, e.g. "Honeypot"
  severity: RugSeverity;
  detail: string;       // short human-readable explanation
  value?: string | number | boolean | null;
}

export interface RugReport {
  tokenId: string;
  chain: string;
  checks: RugCheck[];
  criticalCount: number;
  warningCount: number;
  okCount: number;
  // 0-100: 100 = safest. Lowered by criticals, then warnings.
  safetyScore: number;
  // verdict surfaced to the user
  verdict: "safe" | "caution" | "danger";
  fetchedAt: number;
}

export interface RunnerScoreBreakdown {
  // normalised sub-scores 0..1
  age: number;          // younger = better (more upside potential)
  liquidity: number;    // adequate liquidity = safer runner
  volumeAccel: number;  // recent volume acceleration
  buyerPressure: number; // buyers vs sellers
  priceMomentum: number; // short-window price action
  holderBase: number;   // healthy number of holders (not too few, not concentrated)
  safety: number;       // weighted rugcheck safety
}

export type BondingStatus = "bonding" | "early_liquidity" | "migrated" | "established";

export interface BondingInfo {
  status: BondingStatus;
  progress: number;        // 0..100 — how close to "migrated/established"
  label: string;           // short pill text, e.g. "Bonding · 42%"
  detail: string;          // longer explanation shown in the drawer
  migrationTarget?: string; // human label, e.g. "Uniswap v4" or "Raydium"
}

export type BuyAction = "strong_buy" | "watch" | "skip" | "neutral";

export interface BuyRecommendation {
  action: BuyAction;
  reason: string;
  confidence: number;     // 0..100
}

export interface RunnerToken extends AveToken {
  tokenId: string;          // `{token}-{chain}`
  chain: string;
  ageSeconds: number;
  ageLabel: string;         // "3h 12m"
  runnerScore: number;      // 0..100
  runnerGrade: "A" | "B" | "C" | "D";
  runnerBreakdown: RunnerScoreBreakdown;
  potentialMultiple: number; // estimated ceiling multiple (e.g. 2.4 means "could 2.4x")
  potentialMultipleLabel: string; // "2.4x potential"
  bonding?: BondingInfo;
  recommendation?: BuyRecommendation;
  rugReport?: RugReport;
  socials: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    github?: string;
    description?: string;
  };
  explorerUrl: string;
  aveUrl: string;
}
