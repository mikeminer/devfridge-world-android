# World historical adoption and renewal reproducer

`reproduce-world-metrics.mjs` reads and revalidates the frozen archive in `receipts/`, then calls the existing `perGameLockMetrics` and `timelockRenewalMetrics` exports from `../measurement/metrics.mjs`. It uses only Node standard-library modules and makes no network requests, wallet operations, game changes, cookie measurements or new user-data collection.

Run from this directory:

```sh
node reproduce-world-metrics.mjs
node reproduce-world-metrics.mjs --out world-history-metrics.json
node --test --test-isolation=none reproduce-world-metrics.test.mjs
```

The first command prints the recomputed result without writing. The second regenerates only the dedicated new result. The tests include real-archive integration plus labelled synthetic tampering in memory; test copies are never written to the archive or reported as adopters.

## Dated results

The finalized account snapshot is **2026-10-07T11:28:22.564Z**, slot **454209595**. World has 19 accepted-mint lock accounts, of which 13 are active and 6 expired but unclaimed. The active account fraction is 13/19, or 68.42%. There is **1 qualifying wallet**, publicly labelled as the DevFridge treasury; the count after the declared treasury exclusion is **0**. These are distinct-wallet adoption of the token-gated access model, independent of rounds played, not independent human player counts.

The fixed renewal cohort is each wallet's first observed loss of qualifying commitment for a specific accepted mint: an expiry reduces that wallet's summed active amount of that mint below its threshold. This need not remove access via another character. A subsequent deposit must restore the same wallet/mint's qualifying amount within the inclusive 7- or 30-day window. Only fully elapsed windows enter the denominator. The first cohort loss was CICCIA on **2026-08-19T08:26:00Z**; the same treasury wallet restored qualifying commitment at **11:53:42Z**. Both windows matured before this snapshot. Each window therefore has an internal **1/1 (100%, n=1)** result. After treasury exclusion the cohort is empty: **N/A**, not 0%, and not evidence of external community adoption or retention. The 30-day episode view additionally includes a second CICCIA recommitment; it does not create a second wallet.

## Why the earlier history limitation is resolved for World

The new wrapper verifies 199 raw RPC receipts, complete terminal-empty pagination, all 191 indexed transactions, failed-transaction exclusion, the initial zero-state deployment, closed claim cycles and exact surviving-account reconciliation. There were 146 successful lock creations and 7 claims, yielding 139 currently open accounts. Six physical account addresses were reused after claims; incarnations are reconstructed instead of treating addresses as lifetime deposits. All 19 accepted World-mint creations survive, with exact account creation timestamps, and none was claimed. The post-discovery query found no new signature gap.

This establishes archive coverage for the accepted World mints from **2026-08-18T00:01:52Z** through the finalized snapshot under the **current pinned policy applied retrospectively**. The policy sums unique unexpired locks per wallet and mint against 500,000 tokens of any one of ten accepted mints; it adds no original-duration requirement. Historical game policy versions are not reconstructed. The older SDK plan's one-day rule must not be retroactively substituted for this pinned current access policy.

The original `../measurement/game-metrics.json` remains unchanged and correctly describes its earlier snapshot-only evidence. The adoption helper still exposes its generic `historicalClosedAccountCoverage: unknown` warning; this wrapper separately establishes the accepted-World archive scope and supplies verified coverage to the renewal helper. The helper's `complete_declared` field describes its input contract; the wrapper independently checks the receipts supporting that declaration. No full protocol retention rate is claimed for unrelated mints whose closed creation timestamps require different treatment.

This is a single public RPC archive plus state reconciliation, not an independent validator or program security audit. It establishes neither why a wallet locked tokens nor Android live gameplay, positive SKR execution or external user demand. No earlier frozen inputs, scripts, outputs or measurement symbols are modified.

## Verification

On 2026-10-07, the wrapper syntax check, offline result regeneration and all **10 provenance/integration tests** passed. The existing canonical history result's adoption, renewal rates, cohorts and matched episodes agree with this independent recomputation. The tests also enforce unchanged SHA256 hashes for the earlier snapshot-only output (`ec323e2cb3335a7d4aa731120ca811a8cdbe1e89ace6b71625052d6c5be57316`) and the canonical frozen historical summary (`a63ef062e1e50c9696af1bdf5ac4ccc9794f12f974cd4b9f7533d0b489cfd8ca`).

Only four new files belong to this follow-up: the reproducer, its tests, the dedicated `world-history-metrics.json` result and this note. No commit, push or publication is performed by the reproducer.
