# Stockereum Runner Radar

A PWA that surfaces **early-stage token runners** on the Stockereum launchpad
(Ethereum) **before** they pump — built entirely on the **Ave.ai v2 API**.

The radar detects tokens **while they're still bonding** (or in the
early-liquidity building phase), scores each one 0–100 for runner potential,
runs every token through a full rug-pull guardrail report, and gives you a
clear **STRONG BUY / WATCH / SKIP** recommendation per token — so you can act
on the asymmetric-upside window while the price is still in the curve.

> Live demo: deploy this repo to Vercel and add your `AVE_API_KEY`.

---

## Why this exists

Most "trending" dashboards show you tokens **after** they've already pumped.
Stockereum Runner Radar is the opposite — it surfaces candidates that are:

- **Fresh** (launched within the last 7 days, ideally within hours)
- **Small** (market cap between $5k and $2M — real 2×–3× headroom)
- **Liquid enough** (≥ $5k LP — guardrail against unsellable dust)
- **Active** (≥ $500 1h volume — must be trading right now)
- **Not dying** (4h price action flat or positive)
- **Still bonding or in early liquidity** (the pre-run window the user
  explicitly asked to surface)

### Bonding-curve detection

Every token gets a `bonding` status:

| Status | What it means | How we detect it |
| --- | --- | --- |
| `bonding` | Token is still on a bonding curve (e.g. pump.fun, letsbonk.fun). Steepest discount + steepest risk. | CA suffix convention (`…pump`) + market-cap progress to the ~$69k migration threshold. |
| `early_liquidity` | Freshly-launched token on a non-bonding launchpad (Stockereum / Uniswap v4) with low LP. | Age < 60 min AND main-pair TVL < $25k. |
| `migrated` | Bonding curve complete; token now trades on a regular DEX pool. | Bonding curve complete OR liquidity ≥ $5k with age > 60 min. |
| `established` | Healthy deep liquidity — the asymmetric-upside window has closed. | Liquidity ≥ $100k. |

The bonding badge shows a progress % so you can see **exactly how early** you are.

### Buy recommendation engine

Each token gets a clear verdict:

| Action | Triggered when |
| --- | --- |
| **STRONG BUY** | Runner score ≥ 70, safety verdict = safe, AND still in bonding / early-liquidity phase. |
| **WATCH** | Runner score ≥ 55, verdict ≠ danger. Accumulate on dips. |
| **SKIP** | Any critical guardrail failed. Do not buy. |
| **NEUTRAL** | Borderline safety — wait for cleaner signals. |

Each recommendation carries a 0–100 confidence number.

---

## Runner scoring

Tokens are ranked by a transparent 0–100 **runner score** composed of:

| Sub-score | Weight | What it measures |
| --- | --- | --- |
| Age | 20% | How fresh the launch is (newer = more upside) |
| Liquidity | 12% | LP depth — safer runners |
| Volume acceleration | 18% | Recent (5m/1h) vs 4h/24h average |
| Buyer pressure | 15% | Buy volume / total volume in the last hour |
| Price momentum | 15% | Weighted 5m + 1h + 4h price action |
| Holder base | 5% | Healthy number of holders (penalises <25) |
| Safety | 15% | Ave.ai Contract Risk Detection Report |

A rough **potential multiple** (2.4× etc.) is shown for each token — based on
the headroom to a $5M local top. It's a heuristic, not financial advice.

---

## Guardrails — every rugpull flag surfaced

For every survivor token we call Ave.ai's Contract Risk Detection Report
(`/v2/contracts/{token-id}`) and surface **every** guardrail:

- **Honeypot** — `cannot_buy` / `cannot_sell_all` / `is_honeypot`
- **Liquidity** — LP adequate + raw LP USD volume, thresholds at $5k (critical) and $25k (warning)
- **LP creator concentration** — `analysis_lp_creator_gt_5percent`
- **Token creator concentration** — `analysis_creator_gt_5percent`, `creator_percent` > 50% = critical, > 5% = warning
- **Whale wallet** — `analysis_big_wallet`
- **Scam wallet link** — `analysis_scam_wallet`
- **Mintable authority** — `is_mintable` (inflation-rug risk)
- **Reclaim ownership** — `can_take_back_ownership` (fake renounce)
- **Upgradeable proxy** — `is_proxy`
- **Buy / sell tax** — combined ≥ 25% = critical, ≥ 10% = warning
- **Modifiable limits** — `slippage_modifiable`, `anti_whale_modifiable`
- **Pausable / cooldown** — `transfer_pausable`, `personal_pausable`
- **Source verified** — `is_open_source` (warning if not verified)
- **Blacklist** — `is_in_blacklist`
- **Listed on DEX** — `is_in_dex` (warning if no pool exists)
- **Holders count** — <5 = critical, <25 = warning
- **Burn amount** — informational

Guardrails fail **closed**: missing data is a warning, never a silent pass.
Tokens get an overall **safety verdict** of `safe`, `caution`, or `danger`
and a 0–100 safety score.

---

## Tech stack

- **Next.js 16** App Router + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (New York)
- Ethereum brand palette: dark navy/black background, **Ethereum purple
  `#627EEA`** accents with violet/fuchsia gradients, emerald/amber/rose for
  status (safe / caution / danger). No plain blue/indigo.
- **Ave.ai v2 API** (server-side only — `X-API-KEY` never reaches the client)
- In-memory TTL cache (runner feed 15s, contract risk 5min)
- PWA: manifest, service worker, offline page, maskable + apple-touch icons
- Sticky footer, mobile-first responsive layout

---

## Local development

```bash
# 1. Install deps (Bun recommended; npm/yarn also work)
bun install

# 2. Add your Ave.ai key
cp .env.example .env
#  → edit .env and paste your AVE_API_KEY

# 3. Run the dev server
bun run dev
#   → open the preview on the right; if you opened another tab, visit http://localhost:3000

# 4. (optional) rebuild PWA icons from /public/icon.svg
bun run scripts/build-icons.ts

# 5. Lint
bun run lint
```

Without an `AVE_API_KEY`, the app starts in **demo mode** using curated sample
tokens — every screen and guardrail still works, so you can evaluate the UI
before signing up for the API.

---

## Deploying to Vercel

This repo is configured for zero-config deploys via `vercel.json` (included).
A ready-to-upload zip is in `download/stockereum-runner-radar.zip`.

### Option A — Vercel dashboard (recommended)

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Go to <https://vercel.com/new> and import the repo.
3. Vercel auto-detects Next.js. **Do not override the build command** —
   `vercel.json` already sets `next build` with the right output dir.
4. In **Settings → Environment Variables**, add:
   | Name | Value | Environments |
   | --- | --- | --- |
   | `AVE_API_KEY` | your Ave.ai key | Production, Preview, Development |
5. Click **Deploy**. The first build takes ~1 min. Your PWA will be live at
   `https://<your-project>.vercel.app`.
6. (Optional) Add a custom domain under **Settings → Domains**.

### Option B — Vercel CLI

```bash
# one-time install
npm i -g vercel

# from the project root
vercel        # follow the prompts; pick the project name
vercel env add AVE_API_KEY production preview development
# paste your Ave.ai key when prompted

vercel --prod # deploy to production
```

### Verifying the deploy

After the build finishes, open your Vercel URL and check:

- **`/manifest.json`** returns `application/manifest+json`
- **`/sw.js`** returns `application/javascript`
- **`/icon.svg`**, **`/icons/icon-192.png`**, **`/icons/icon-512.png`** all 200
- **`/api/health`** returns `{"status":"ok","aveApiKeyConfigured":true,"demoMode":false}`
- Chrome DevTools → Application → Manifest shows "Installable"

### Troubleshooting on Vercel

| Symptom | Fix |
| --- | --- |
| "AVE_API_KEY is not configured" toast | Re-add the env var to all 3 environments and redeploy |
| `429` rate-limit errors | Reduce auto-refresh in `src/app/page.tsx` (`AUTO_REFRESH_MS`) or upgrade your Ave.ai plan |
| `401/403` auth errors | Key is wrong / revoked — reissue at <https://cloud.ave.ai/register> |
| PWA not installable on iOS | iOS needs HTTPS + apple-touch-icon. Vercel gives you both automatically |
| Build fails on `prisma generate` | Not used at runtime — the project doesn't require a DB. If you remove the `prisma` folder, delete the `db:push` script too |
| `sharp` warnings during build | Already a dependency; safe to ignore |

---

## Project structure

```
prisma/                       # optional Prisma schema (not required at runtime)
public/
  icon.svg                    # source SVG logo (Ethereum-purple diamond + radar ring)
  favicon.ico                 # multi-resolution ICO (16/32/48/64)
  manifest.json               # PWA manifest
  sw.js                       # service worker (network-first navigations)
  offline.html                # offline fallback shell
  icons/
    icon-192.png              # any-purpose 192
    icon-512.png              # any-purpose 512
    maskable-512.png          # full-bleed Android adaptive icon
    apple-touch-icon.png      # 180px iOS home-screen icon
    favicon-16.png, favicon-32.png
scripts/
  build-icons.ts              # regenerate all PNG/ICO icons from /public/icon.svg
src/
  app/
    layout.tsx                # PWA metadata, theme color, SW registration
    page.tsx                  # main dashboard (Runners / Search / Watchlist)
    globals.css               # Ethereum brand palette (#627EEA)
    api/
      health/route.ts         # /api/health — key + cache status
      chains/route.ts         # /api/chains — Ave.ai supported chains
      runners/route.ts        # /api/runners — the early-runner feed (+bonding +recs)
      tokens/search/route.ts  # /api/tokens/search — symbol/CA search
      tokens/[address]/route.ts            # full token detail + rug report
      tokens/[address]/security/route.ts   # raw security report
  lib/
    ave-api.ts                # Ave.ai v2 client (server-only)
    runner-detector.ts        # 0..100 runner score + bonding detector + buy recs
    rugcheck.ts               # 17-check rugpull report from Contract Risk Detection
    cache.ts                  # in-memory TTL cache
    types.ts                  # shared Ave.ai + domain types
    format.ts                 # USD / pct / age formatters
    demo-data.ts              # sample tokens for demo mode
  components/
    pwa/service-worker-register.tsx
    runners/                   # TokenCard, TokenDetailDrawer, SecurityPanel,
                               # FiltersBar, RunnerScoreRing, CopyButton,
                               # SeverityBadge, BondingBadge, BuyRecommendationPill,
                               # useWatchlist, states
vercel.json                  # zero-config Vercel deploy spec
.env.example                 # env var template
README.md                    # this file
download/
  stockereum-runner-radar.zip  # ready-to-upload bundle for Vercel
  README.md                   # deploy instructions
```

---

## Ave.ai API surface used

| Endpoint | Used for |
| --- | --- |
| `GET /v2/supported_chains` | Chain selector |
| `GET /v2/tokens/trending?chain=…` | Hottest tokens on a chain |
| `GET /v2/ranks?topic=…` | Topic-ranked tokens (`new`, `gainer`, `eth`, `meme`) |
| `GET /v2/tokens?keyword=…` | Search by symbol or CA |
| `GET /v2/tokens/{token-id}` | Full token detail |
| `GET /v2/contracts/{token-id}` | Contract Risk Detection Report (rugpull checks) |
| `GET /v2/tokens/top100/{token-id}` | Holder concentration |
| `GET /v2/klines/token/{token-id}` | Price candles (available for future sparkline UI) |

All requests carry `X-API-KEY`. The key lives only in the Next.js server
runtime — the client only talks to our `/api/*` routes.

---

## Disclaimers

This software is **not financial advice**. Memecoin trading is extremely
risky and most launches end at zero. The runner score, safety score, bonding
status, and buy recommendation are automated heuristics computed from Ave.ai
data — they can be wrong and they are not guarantees. Always do your own
research, never invest more than you can afford to lose, and treat every
freshly-launched token as untrusted by default.

