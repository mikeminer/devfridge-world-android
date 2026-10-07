# DevFridge World: cookie-free on-chain baseline — 7 October 2026

This report supplies reproducible evidence of DevFridge protocol activity, the game's token-lock prerequisite and real optional TopShelf score registrations. It separates publisher activity from evidence of independent players. Collection was read-only: no cookies, analytics SDK, wallet signature or transaction was requested.

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
| Unique wallets meeting the character-token rules | 1 | The publicly labelled Solana treasury |
| Qualifying game wallets excluding that treasury | 0 | Current lock-prerequisite snapshot only |
| Confirmed TopShelf score-registration events | 15 | Real successful contract events |
| Unique TopShelf participants | 1 | The current contract owner, linked to that treasury |
| Distinct UTC registration dates for that participant | 7 | Repeated publisher registrations |
| TopShelf registered participants excluding the owner | 0 | Full captured contract-event interval |
| Repeat registered participants excluding the owner | 0 | No independent return evidence in that interval |

The four ecosystem depositor addresses are not assumed to be four independent people. The sole qualifying game-token address is the public `TREASURY` constant. The sole TopShelf participant equals `owner()` at the pinned block; `playerSolana` and `solanaPlayer` map it to the same Solana treasury. These source labels and contract relationships support the exclusion, without identifying a private person.

**The data demonstrate on-chain implementation and repeated publisher use. They do not establish independent-player retention or Android usage.** They also do not establish zero overall game users: unregistered play and local practice are outside this measurement.

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
