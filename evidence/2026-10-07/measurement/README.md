# Cookie-free on-chain adoption measurement

This standalone Node utility reads the published, dated on-chain evidence. It sends no requests, signs no transactions, reads no private credentials, sets no cookies, and adds no tracking to the game. Its business scope is adoption of the game's access model through the tradeoff of locking a token to gain access, independently of rounds played. The measurement unit is a distinct qualifying wallet.

## Adoption definition

`eligibleWalletCount` measures **current adoption of the game's token-gated access model**: the number of distinct wallets holding qualifying active locks of an accepted game mint at the dated snapshot. Multiple locks of the same mint can jointly reach its threshold; multiple character unlocks still count as one adopted wallet. Playing a round is not required for this business definition. This is a wallet-level eligibility metric, rather than evidence of distinct human identities, installation, or the reason each wallet originally locked its tokens.

Renewal measures **retained or repeated adoption after expiry**: the same wallet makes a new qualifying commitment for the same accepted mint after its previous qualifying position expires, within a stated observation window. Locked quantity per mint and locked-supply percentages complement wallet adoption by describing its economic intensity. Quantities remain separate for each mint, and the active account fraction describes the state of observed locks; renewal retention uses its own expiry cohort.

Declared treasury exclusions preserve both the gross adoption count and the subtotal after exclusion. The dated evidence contains one qualifying treasury wallet and zero observed qualifying wallets after that exclusion; it does not establish external human adoption. Missing claimed/closed-account history continues to limit historical renewal percentages.

## Reproduce

Use Node.js with the built-in test runner (tested on Node 24.18.0). No npm install or external libraries are required. From this directory:

```powershell
node --check metrics.mjs
node --test --test-isolation=none metrics.test.mjs
node metrics.mjs
node metrics.mjs --out game-metrics.json
```

The last command writes only the explicitly requested result file. The ordinary command prints JSON. Input paths are resolved relative to this script, so it can also be invoked from another working directory. On this Windows sandbox, the ordinary `node --test metrics.test.mjs` child-process isolation was blocked with `spawn EPERM`; `--test-isolation=none` runs the same 27 tests without spawning child processes. All test fixtures are clearly synthetic and are not player evidence.

`game-metrics.json` uses the original receipt's **2026-10-07T08:58:15.000Z** timestamp and confirmed context slot **454175939**, rather than today's wall-clock time. The input is [decoded-locks.json](../onchain/receipts/decoded-locks.json); raw RPC receipts, decoding and source pins are in the adjacent [on-chain evidence](../onchain/README.md).

## Pinned policy and source boundary

[game-policy.json](./game-policy.json) identifies `devfridge-world-current-access-5d9ab246`: the ten exact World mints, six decimals, and 500,000-token threshold (`500000000000` raw) for any one mint. Unique unexpired lock amounts are summed per wallet and mint; tokens of different mints never combine. One wallet unlocking several characters counts once in the eligible-wallet union. Expiry is strict: `unlockAt > asOfUtc`. The policy adds no minimum original duration or additional remaining-duration requirement.

The current access predicate is included as the exact [access.ts source excerpt](../badges/source-excerpts/access.ts#L15) from Cold Storage commit `5d9ab2464014bdef53dd129a6148c8e1d4364949`. Its normalized UTF-8/LF SHA256 is recorded in the policy and [source manifest](../badges/sources-manifest.json). The original source checkout's public remote availability was not independently verified; the included excerpt and the [public compiled game](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/public/world/game/assets/index-BRorhYzL.js) make that boundary explicit. The [mint manifest](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/topshelf/engine/tokens.json) is pinned separately.

Older SDK-based access paths used a one-day original-duration plan. Current Cold Storage reads active locks and applies the amount threshold directly. **Retrospective reconstruction applies the current pinned rules uniformly; it does not establish which game policy was in force on earlier dates.** The August one-hour locks qualify under this current policy, not necessarily under that older SDK path.

## Exported calculations

`perGameLockMetrics(snapshot, policy)` reports accepted-mint accounts, the fraction `active / (active + expired-unclaimed)` among existing accounts, amounts separately for each mint, and the union of currently eligible wallets used for the adoption count. Matching address duplicates are ignored; conflicting duplicates, unsafe numeric amounts, invalid dates, and future creation dates are rejected. BigInt handles raw amounts without floating-point conversion. The utility trusts the adjacent raw-receipt decoder for account-owner/discriminator provenance; it does not independently query or validate the chain.

`timelockRenewalMetrics(snapshot, policy, { renewalWindowDays, coverage })` reconstructs economic commitment renewal as retained or repeated adoption. A qualifying loss occurs when expiries reduce a wallet's active balance for a particular accepted mint from at least the threshold to below it. It need not lose access through other character mints. A new deposit at/after this expiry renews that commitment only if the same wallet's same-mint sum reaches the threshold again within the explicit, inclusive window. Deposits made before expiry, other mints, and later balances below the threshold are not renewals. At the same second, expiry is processed before a new deposit.

The wallet denominator is fixed at each wallet's **first observed qualifying mint-loss**; later cycles do not add the wallet again. If several mints lose qualification at that first instant, reacquisition of any of those mints qualifies. Only fully elapsed observation windows enter the wallet denominator. The report calculates both 7 and 30 days, explicitly. Episode counts include all observed matched cycles and are separate from the deduplicated first-loss wallet cohort. For account-level reporting each matched expiry group pairs old/new account addresses one-to-one. A single new account cannot become several purported lock renewals. These pairs are conservative inferred links, not evidence that specific old funds were recycled.

The [Fridge program](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/programs/fridge/src/lib.rs#L48) exposes `create_lock` and `claim`; it has no renew/extend instruction. Claims close the lock account. Thus an existing-account snapshot omits previously claimed/closed locks and cannot establish a complete historical denominator. Observed renewals are evidence of same-wallet recommitment within the visible archive, not a historical retention percentage.

A historical rate is enabled only if the caller explicitly supplies all of:

```json
{
  "gameId": "devfridge-world",
  "complete": true,
  "includesClosedAccounts": true,
  "initialStateKnown": true,
  "fromUtc": "<ISO UTC timestamp>",
  "throughUtc": "<ISO UTC timestamp>",
  "sourceEvidence": "<auditable complete-history source>"
}
```

The utility treats this as a **coverage declaration**, not independent proof. Only cohorts with expiry and the entire renewal window inside the declared interval enter the rate. Missing/incomplete coverage returns `unavailable` with `null` percentages and unknown historical denominators; a known complete interval containing no mature cohorts returns `not_applicable`, not 0%. The real dated snapshot has no complete historical coverage declaration.

## Dated result and attribution

The current policy selects 19 existing lock accounts: 13 active and 6 expired-unclaimed, an account fraction of **68.42105263%**. There is **one eligible wallet**. It is the publicly labelled [DevFridge treasury](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/constants.ts#L12). The declared exclusion is preserved as a visible subtotal: one eligible wallet before exclusion, zero after exclusion. Other unlabelled wallets must not automatically be called external people or Android players.

For CICCIA, the visible treasury position lost qualification on **August 19 at 08:26:00 UTC** and regained it through a new 3,657,477-token lock at **11:53:42 UTC** that day. It lost qualification again at **12:53:00 UTC** and regained it on **September 7 at 17:46:43 UTC**: the new 500,000-token lock raised the active same-mint total from 120,000.156028 to 620,000.156028 tokens.

The 7-day window has one observed matched episode/pair; the 30-day window has two. Both show **one observed renewing wallet**, the treasury; both show zero after declared treasury exclusion. Historical renewal retention percentages remain **unavailable/null** for both windows, including the excluded-wallet subtotal. A FIFO lock created before a different FIFO lock expired is not counted as post-expiry recommitment. Badge locked-supply percentages are separate per-mint economic state and are not session analytics.

Public wallet addresses are pseudonymous rather than anonymous. This utility processes only the already published on-chain evidence and requires no new game telemetry. No TopShelf paid score registrations or local practice records are used as retention inputs.
