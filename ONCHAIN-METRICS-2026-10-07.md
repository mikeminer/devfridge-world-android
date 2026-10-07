# DevFridge World: one shared Solana program, per-game token commitment — 7 October 2026

One existing Fridge Solana timelock program supports per-game measurement of token commitment. The game-builder skill supplies each game's accepted-mint mapping, exact raw amount thresholds and duration configuration. The offline calculator filters the shared accounts into game wallets with timelocked access, per-mint locked quantity, active-lock fraction and renewal retention; existing scanner badges combine active locked quantity with token supply to show its percentage. There is no new Solana timelock contract per game and no cookie analytics. This is an off-chain game-policy mapping, not an on-chain GameID registry; the same wallet can qualify for two games accepting its mint and rules, so their counts are not additive as ecosystem-unique wallets.

Holders give up the ability to transfer or use the locked amount until expiry to obtain qualifying character access; this is the economic tradeoff measured, independently of rounds played.

This report preserves the dated read-only program snapshot, game-policy calculation and optional TopShelf registrations. Publisher activity is labelled separately. Collection requested no cookies, analytics SDK, wallet signature or transaction; it does not change the existing entry flow's separate essential adult-consent cookie.

## Recorded metrics and attribution

| Metric | Recorded value | Interpretation |
| --- | ---: | --- |
| Existing recognized DevFridge lock accounts | 139 | Current unclaimed program accounts, not lifetime deposits |
| Active lock accounts | 84 | Unexpired at the recorded account-response time |
| Expired, unclaimed lock accounts | 55 | Existing accounts past their unlock time |
| Unique protocol depositor wallets | 4 | Ecosystem addresses; not four game players or people |
| Unique locked token mints | 21 | Protocol token coverage |
| Existing locks for the ten exact character mints | 19 | Game-token prerequisite accounts |
| Active game-token lock accounts | 13 | Unexpired; all also pass the legacy SDK duration filter |
| Game-token active-lock account fraction | 68.42% | 13 active / 19 existing accepted-mint accounts; six expired-unclaimed remain in the denominator |
| Game wallets with timelocked access | 1 | The publicly labelled Solana treasury; distinct wallet union, independent of play frequency |
| External game wallets with timelocked access | 0 | Current access snapshot after excluding that treasury |
| Observed renewing wallets, 7-day window | 1 | Treasury wallet; one observed same-mint renewal episode |
| Observed renewing wallets, 30-day window | 1 | Same treasury wallet; two observed same-mint renewal episodes |
| Observed external renewing wallets, either window | 0 | Existing-account sample after treasury exclusion; historical rate unavailable |
| Confirmed TopShelf score-registration events | 15 | Real successful contract events |
| Unique TopShelf participants | 1 | The current contract owner, linked to that treasury |
| Distinct UTC registration dates for that participant | 7 | Repeated publisher registrations |
| TopShelf registered participants excluding the owner | 0 | Full captured contract-event interval |
| Repeat registered participants excluding the owner | 0 | No independent return evidence in that interval |

The four ecosystem depositor addresses are not assumed to be four independent people. The sole qualifying game-token address is the public `TREASURY` constant. The sole TopShelf participant equals `owner()` at the pinned block; `playerSolana` and `solanaPlayer` map it to the same Solana treasury. These source labels and contract relationships support the exclusion, without identifying a private person.

**The data establish token commitment, current per-game access and repeated publisher registration.** Renewal retention concerns continued commitment after expiry, independently of how often a wallet plays. Android attribution and unregistered play are outside this measurement; zero external eligible or registered wallets does not mean zero overall game users.

## Per-game policy and metric definitions

A policy lists the game's accepted mints, each mint's decimals and raw-unit access threshold, plus its required original-duration predicate. Account addresses are deduplicated before qualifying raw amounts are summed **within the same wallet and mint**. Amounts from different mints never combine. A wallet qualifies if at least one accepted mint reaches its own threshold; the distinct-wallet union counts it once across all qualifying mints. These are game wallets with timelocked access, not a count of verified playing wallets or distinct people. Overlapping game policies must not be summed as globally unique wallets.

The current Cold Storage policy requires 500,000 tokens for a selected character mint and uses unexpired `status.activeLocks` directly. It does not independently enforce the legacy SDK plan's one-day original-duration filter. All 13 active game-token accounts in the dated snapshot also satisfy that legacy filter; the two predicates are distinct even though this sample's results agree.

The **active-lock fraction** is the count of active accepted-mint accounts divided by all existing accepted-mint accounts: `13 / 19 * 100 = 68.42%`. Its denominator includes six expired-unclaimed accounts. Claimed/closed accounts are absent. This is neither a historical renewal rate nor the badges' locked-amount / total-supply percentage.

### Timelock renewal retention

The product's retention metric is **continued token commitment through post-expiry renewal**. Fix an expiry cohort at each wallet's first observed loss of qualifying **same-mint commitment**: its summed active qualifying amount meets the threshold immediately before expiry and falls below it after expiry. This does not require loss of access through every other accepted mint. Count wallets whose new deposit at or after that expiry restores the same wallet/mint's qualifying aggregate to the threshold within the declared inclusive renewal window. Locks opened before expiry are not post-expiry renewals. The renewal fraction is renewing wallets / that fixed expiry cohort. All observation windows must be fully matured; a still-open window is not a failed renewal. Apply treasury/owner exclusions consistently to both numerator and denominator.

There is no explicit renewal instruction in the examined program interface: the observable renewal is a new lock following an eligible prior expiry. Its existence does not establish that funds were redeemed from the old vault or reused. The current policy is applied retrospectively to preserved account timestamps; this does not prove which historical game-access rules were in effect then.

In the existing-account sample, the **7-day window has one observed renewing wallet and one same-mint episode; the 30-day window has the same one wallet and two episodes**. Both are the labelled treasury. Excluding it leaves **zero observed external renewing wallets**, not a measured external historical renewal rate. The CICCIA sequence first expires on 19 August 2026 at 08:26 UTC and has a qualifying new deposit at 11:53:42 UTC that day. A second same-mint expiry at 12:53 UTC on 19 August precedes the new qualifying deposit on 7 September at 17:46:43 UTC. The first sequence fits both windows; the second fits the 30-day window. A wallet is counted once in the cohort even when multiple episodes are retained as supporting observations.

The current account snapshot cannot recover already-claimed/closed locks, so it supports observed renewal sequences rather than a complete historical renewal rate. A fully covered empty cohort is N/A; incomplete history is unavailable, not 0%. The window is explicit and configurable: the dated output reports separate 7- and 30-day observations rather than silently choosing a universal product period.

[Implemented offline calculator and definitions](evidence/2026-10-07/measurement/README.md), [dated calculated output](evidence/2026-10-07/measurement/game-metrics.json) and the preserved raw accounts make the policy calculations reproducible. This adds no live analytics collector or gameplay/session attribution and changes no existing game, backend or APK.

## How Solana connects to the live game

The player selects a community character and authorizes a Solana account. The live game's character access checks the corresponding mint's timelocks. The server checks active matching-mint locks before starting a verified live run. Local practice is a separate onboarding route with isolated storage and blocked wallet/ranked requests. Optional TopShelf registration records a verified live score on Robinhood Chain through its separate EVM flow.

The source-linked prerequisite is at least **500,000 tokens per wallet and selected character mint**, summed using integer raw units and the mint's decimals, across distinct unexpired locks. The older v2 SDK-plan path additionally filters original duration using `floor((unlockAt-createdAt)/86400) >= 1`. The current Cold Storage entry reads `status.activeLocks` directly, without requiring that SDK plan's result, so its entry predicate does not independently enforce original duration. All 13 active game-token accounts in this snapshot pass the additional legacy duration filter anyway; the wallet counts are unchanged. [Current predicate and source excerpts](evidence/2026-10-07/badges/README.md#current-access-predicate-and-sdk-duration-distinction) document the distinction.

This source and lock evidence does not establish a newly executed eligible Android round, signed beta.2 execution, wallet consent or legal/compliance eligibility. [Recorded Android evidence](ANDROID-EVIDENCE-2026-10-06.md) remains a separate scope.

## Per-character badges in the live game

The [live game access page](https://world.devfridge.cool/game) embeds ten clickable [DevFridge Scan badges](https://scan.devfridge.cool/badge), one for each exact character mint. Chrome inspection confirmed that all ten SVG images loaded successfully. Each displays its token's timelocked amount and percentage of total supply, and opens the scanner for that mint. [Captured game view](evidence/2026-10-07/badges/world-game-badges.png).

The numerator sums **all unexpired DevFridge lock amounts for the exact mint across all depositor wallets**. The denominator is that mint's total token supply, in the same raw units. The displayed percentage is `floor(activeRawAmount * 10000 / supplyRaw) / 100`, formatted to two decimal places. The aggregate badge is separate from the connected wallet's 500,000-token character-access predicate.

| Character token | Badge locked amount | Displayed supply percentage |
| --- | ---: | ---: |
| RUGARUGO | 600,000 | 0.06% |
| CICCIA | 610,000.16 | 0.06% |
| APE, FIFO, FUSILLI, LAMBOCELLO, GMGN, SESU, MOONZARELL, BONKATINO | 500,000 each | 0.05% each |

All ten unauthenticated requests returned HTTP 200 at **2026-10-07 09:23:52–09:23:53 UTC**. A separate confirmed `getTokenSupply` response for RUGARUGO returned 1,000,000,000 tokens at slot **454181726**, consistent with its displayed 0.06%. These are separate observations, not a synchronized common-slot snapshot. The badge route permits 60-second CDN caching plus 300 seconds of stale delivery during revalidation, and a 30-second process lock cache. Its SVG contains no ledger slot or data timestamp; HTTP delivery time does not establish the exact chain-data time.

This is observable Solana integration and token commitment associated with the playable cast. It does not count game sessions, unique players, Android use or returns: neither a game-event tag nor platform identity is present in the badge. Expired unclaimed vaults can display “FRIDGED” without an active percentage; unavailable supply omits the percentage. [Exact formula, current access source, raw SVGs and HTTP receipts](evidence/2026-10-07/badges/README.md) preserve the evidence without adding cookie analytics.

## Solana collection

Account response completed at **2026-10-07 08:58:15 UTC**, confirmed context slot **454175939**. The mainnet genesis hash was `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`.

Public endpoint: `https://scan.devfridge.cool/api/rpc`. Method: `getProgramAccounts`. Program: `9RY54dNPYTzDyh3TfFqDdt2b2KMM56KW1tw9erRTGQo6`. Options: `encoding: "base64"`, `commitment: "confirmed"`, `withContext: true`, and `filters: [{dataSize: 105}]`.

The collector verifies program owner, account length, Lock discriminator and unique account address before decoding depositor, mint, amount, creation and unlock times. It filters the exact ten game mints from the pinned manifest. Unexpired status uses the account-response completion time; zero accounts were rejected. The protocol totals agree with the separately captured public statistics API, which has caching and no context slot.

Already-claimed/closed accounts are absent. The existing game-token accounts span four creation dates from 19 August to 8 September 2026; those are lock-creation dates, not gameplay-return dates or a complete lifetime cohort.

## TopShelf event coverage

Chain ID **4663**, Robinhood Chain. Contract: `0xc1DB49694E0DB50778c333350C8A553fDE221989`.

Successful direct creation transaction: [0x8e3aea48…](https://robinhoodchain.blockscout.com/tx/0x8e3aea48be89848525aa73532f5702d79b2eec0cfa0a93841f38a2f11faa0400), block **59392721**.

All `ScoreRegistered` events were retrieved from creation through pinned block **82351824**, timestamp **2026-10-07 09:02:29 UTC**. Three contiguous, nonoverlapping intervals succeeded; zero logs were rejected. Collection completed at **09:02:36 UTC**. Earlier failed archive/oversized requests are retained alongside the successful bounded queries.

The 15 registrations span **10 September 2026 14:23:46 UTC** through **30 September 2026 23:43:04 UTC**, across seven distinct UTC dates. Separate pinned-state calls report season 1, one participant and 15 registrations. The participant's recorded `runs` is 15 and best score is 49,460.

The sole participant is the current contract owner. These dates establish repeated owner registration activity. They do not establish gameplay duration, Android versus browser use, share usage, advice effectiveness, D1/D7 retention or independent-player demand. Contract events also do not prove that any specific public demonstration or APK execution made those registrations.

## Raw evidence, sources and reproduction

[Machine-readable summary](evidence/2026-10-07/onchain/receipts/summary.json), [decoded lock accounts](evidence/2026-10-07/onchain/receipts/decoded-locks.json) and [decoded score events](evidence/2026-10-07/onchain/receipts/topshelf-score-events.json) include exact counts, classifications and block/transaction references.

[Full request/response receipts](evidence/2026-10-07/onchain/receipts) preserve endpoint, method, payload, HTTP status, timestamps, full response body and errors. [Pinned source manifest](evidence/2026-10-07/onchain/sources-manifest.json) records source commit URLs and SHA-256 hashes. [Collector instructions](evidence/2026-10-07/onchain/README.md) describe the portable Node.js 20+ collection; no package installation or private API key is required.

Verify the preserved observations offline from the repository root:

```powershell
node evidence/2026-10-07/onchain/verify.mjs
```

Collect a fresh snapshot into a new directory, preserving the dated receipts:

```powershell
node evidence/2026-10-07/onchain/collect.mjs ./fresh-onchain-receipts
node evidence/2026-10-07/onchain/collect-topshelf.mjs ./fresh-onchain-receipts
```

A fresh run can produce different counts as the chains change. Errors remain unavailable/incomplete evidence rather than fabricated zero counts. The offline verifier checks receipt consistency and interval coverage; it is not a security audit of the timelock or TopShelf program.

## Source anchors

[Game wallet prerequisite](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/world-game-v2/src/wallet.js), [SDK duration rule](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/public/sdk/devfridge-sdk.js), [live-run server prerequisite](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/topshelf/registration.ts), [exact character mints](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/topshelf/engine/tokens.json) and [public treasury label](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/constants.ts).
