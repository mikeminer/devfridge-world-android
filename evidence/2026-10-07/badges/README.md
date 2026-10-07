# Per-character timelock badges in DevFridge World

The game access page embeds a separate full Fridge badge for each of the ten character mints. Each badge displays the character token's actively timelocked supply and links to its live scanner page. The on-chain timelock prerequisite also controls which character the connected wallet can enter with. This is an implemented, visible connection between the game and the DevFridge/Solana ecosystem; it does not measure game sessions or identify returning players.

The public image endpoint is `https://scan.devfridge.cool/api/badge?mint=<exact-mint>&theme=dark&style=full`. Declared query keys are `mint`, `theme` (`dark` or `light`) and `style` (`full` or `compact`). Successful responses are SVG images, not JSON analytics. The `<mint>` is the exact Solana address, not the ticker.

## Dated HTTP observations

All ten image requests returned HTTP 200 on **7 October 2026, 09:23:52–09:23:53 UTC**, without cookies, credentials or a Referer header. RUGARUGO displayed **600,000 tokens / 0.06% of supply**; CICCIA displayed **610,000.16 / 0.06%**; the remaining eight displayed **500,000 / 0.05%** each. SVGs and full delivery receipts are retained in `receipts/`.

An independent representative `getTokenSupply` request to the official Solana mainnet RPC returned RUGARUGO supply **1,000,000,000 tokens**, raw `1000000000000000`, decimals 6, at confirmed context slot **454181726**, captured **09:23:53 UTC**. The displayed 600,000 divided by this denominator yields 0.06%. This comparison uses separate observations, not a synchronized common ledger snapshot.

The RUGARUGO image had `x-vercel-cache: STALE`, `Age: 114` and HTTP Date **09:21:58 UTC**. Source configuration sets `s-maxage=60`, `stale-while-revalidate=300`; the process lock cache is 30 seconds. The SVG contains no ledger slot or data timestamp. Request times establish delivery provenance; they must not be presented as the exact time/slot at which its supply and locks were queried.

## Meaning of the percentage

The numerator is the sum of raw token amounts in **all unexpired DevFridge locks for that exact mint**, across all depositor wallets. The denominator is that mint's current total token supply in the same raw units. The source displays `floor(activeRawAmount × 10000 / supplyRaw) / 100`, formatted to two decimal percentage places.

This measures economic commitment to the character token. It does not contain a game-specific tag, Android/web platform tag, session count, badge view count or player-return measurement. Existing expired but unclaimed vaults may still render “FRIDGED” without an active percentage. If supply is unavailable, the percentage is omitted rather than inferred.

The badge route records at most 20 distinct external referring domains per mint, once per domain, and excludes domains ending `devfridge.cool`. That is a domain-discovery list, not a request counter or player cohort. The game uses lazy-loaded badge images, so image requests also cannot be equated with completed play. This evidence adds no cookie analytics.

## Current access predicate and SDK duration distinction

The current Cold Storage access code validates wallet ownership, mint, amount, unlock time and unique lock addresses, and sums unexpired amounts separately for each character mint. The threshold is **500,000 token units of that same mint**. Wallet authentication and character selection are separate from the aggregate supply badge.

The current wrapper configures an SDK plan with `minLockDays:1`, but consumes `status.activeLocks` directly and does not require `status.active` or a matched plan. Its entry predicate does not independently enforce original lock duration. The older v2 SDK-plan path applies the one-day duration filter. The earlier captured 13 active game-token locks satisfy that duration condition anyway, so the observed wallet counts do not change. This distinction concerns source predicates; it does not establish live Android entry execution.

## Source locations

Game embedding: [access-ui.ts](source-excerpts/access-ui.ts), line 56; current active-lock reader: [devfridge-locks.ts](source-excerpts/devfridge-locks.ts), lines 45–59; current character threshold: [access.ts](source-excerpts/access.ts), lines 15–23. These are the exact frontend source files from the separate Cold Storage checkout at commit **5d9ab2464014bdef53dd129a6148c8e1d4364949**, included here with matching SHA-256 after LF normalization. They are not paths in DevFridge monorepo commit 2e0064c. The compiled game bundle containing the embedding is [index-BRorhYzL.js](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/public/world/game/assets/index-BRorhYzL.js) in the public DevFridge repository. The source checkout's remote repository is `mikeminer/devfridge-world`; its unauthenticated public availability was not independently verified, so the included files provide the auditable source anchor.

Badge request/supply/cache: `scan/app/api/badge/route.ts:17,45–58`; aggregate active-lock numerator: `scan/lib/badge.ts:95–102`; exact percentage formula: `scan/lib/format.ts:37–42`; referring-domain deduplication: `scan/lib/store.ts:193–199`. SHA-256 source pins are in `sources-manifest.json`.

Reproduce the unauthenticated public requests with Node.js 20 or newer, keeping `capture-badges.mjs` and `game-tokens.json` together:

```sh
node capture-badges.mjs ./fresh-receipts
```

No packages or API keys are required. The collector preserves provider errors; the original capture used the official RPC fallback after PublicNode declined the representative indexed request.
