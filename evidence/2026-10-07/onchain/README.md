# Cookie-free on-chain measurement receipts, 7 October 2026

This collection uses public read-only HTTP/JSON-RPC endpoints. It uses no cookies, wallet signing, payment, analytics SDK or private API key. It measures observable wallets, timelocks and optional registered scores; it does not identify people or Android sessions.

## Reproduce a fresh collection

Node.js 20 or newer is sufficient. Keep `collect.mjs`, `collect-topshelf.mjs`, `game-tokens.json` and `abi-descriptor.json` together. No npm install is required. Choose a new output folder to preserve the dated receipts:

```sh
node collect.mjs ./fresh-receipts
node collect-topshelf.mjs ./fresh-receipts
```

The collector saves the complete response bodies and request/response metadata, including exact RPC methods, filters, endpoint, HTTP status, timestamps, confirmed Solana context slot and pinned Robinhood block. Errors are kept as errors, never replaced with fabricated zero metrics. The supplied ABI descriptor records selectors and the event topic derived from the pinned existing contract ABI; the portable collection requires no workspace-specific helpers.

## Captured observations

Solana mainnet snapshot: **7 October 2026, 08:58:15 UTC**, confirmed slot **454175939**. `getProgramAccounts` queried DevFridge program `9RY54dNPYTzDyh3TfFqDdt2b2KMM56KW1tw9erRTGQo6` with `encoding:base64`, `commitment:confirmed`, `withContext:true`, and `dataSize:105`. Every account was checked for program owner, length, discriminator and unique address.

| Scope | Observation |
|---|---:|
| Existing protocol lock accounts | 139 |
| Active protocol lock accounts | 84 |
| Expired, unclaimed protocol lock accounts | 55 |
| Unique protocol depositor wallets | 4 |
| Unique protocol token mints | 21 |
| Existing locks for the game's ten exact mints | 19 |
| Active locks for the game's ten exact mints | 13 |
| Unique game-token depositor wallets | 1 |
| Wallets meeting the on-chain amount/time rule | 1 |
| Eligible wallets after excluding the publicly labelled treasury | 0 |

Game eligibility sums **500,000 token units** per wallet and exact character mint across unique, unexpired lock accounts, with integer amounts and the manifest's mint decimals. The game SDK additionally requires each qualifying account's original duration to be at least one whole day. All 13 active game-token accounts satisfy that duration condition. This measures the lock prerequisite only; it does not prove wallet authorization, device execution, legal eligibility or actual play.

The sole game-token depositor is the public `TREASURY` address in the pinned source. Its 19 existing game-token locks were created across four UTC dates, from 19 August to 8 September 2026. This is repeated lock activity, not repeated gameplay. Closed/claimed accounts are absent from the snapshot, so these dates are not a complete historical cohort.

TopShelf on Robinhood Chain **4663**: contract `0xc1DB49694E0DB50778c333350C8A553fDE221989`. Direct creation is verified by successful receipt `0x8e3aea48be89848525aa73532f5702d79b2eec0cfa0a93841f38a2f11faa0400`, at block **59392721**. All `ScoreRegistered` logs were retrieved from creation through pinned block **82351824**, whose timestamp is **7 October 2026, 09:02:29 UTC**. Three nonoverlapping intervals succeeded; zero logs were rejected. Archive state at block zero and oversized-range errors are preserved, followed by the successful bounded queries.

| Optional registered-score metric | Observation |
|---|---:|
| Confirmed score-registration events | 15 |
| Unique registered EVM wallets | 1 |
| Distinct UTC registration dates for that wallet | 7 |
| Registered wallets other than the current contract owner | 0 |
| Returning registered wallets other than the owner | 0 |

Registrations span **10 September 2026, 14:23:46 UTC** to **30 September 2026, 23:43:04 UTC**. Pinned contract state independently reports season 1, one participant and 15 registrations; the participant's `runs` is 15 and best score is 49,460. The sole participant is the current contract owner, labelled Pastaman by the public game API. `playerSolana` and `solanaPlayer` link it to the same publicly labelled Solana treasury. Its repeat registrations establish on-chain implementation/use by the owner; they are not evidence of independent-player retention.

Wallets are not people. TopShelf metrics cover optional paid score registrations, excluding unregistered play and local practice. The events contain no Android/web platform marker. **Android players, independent gameplay retention, D1/D7, shares and practice sessions remain unmeasured by this collection.** The absent independent-wallet observations do not establish zero overall game users.

## Files and provenance

`receipts/summary.json` contains machine-readable observations, classifications, limits and receipt references. `receipts/decoded-locks.json` contains decoded accounts; `receipts/topshelf-score-events.json` contains decoded events with transaction/block references. Every numbered `.receipt.json` references a full `.body.txt` response. `game-tokens.json` and `abi-descriptor.json` supply exact inputs. `sources-manifest.json` pins source files, SHA-256 and commit URLs. `verify.mjs` checks the captured result offline without third-party packages.
