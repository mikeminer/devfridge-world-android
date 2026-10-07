# Archived Solana access adoption and renewal — 7 October 2026

The historical coverage gap in the earlier existing-account snapshot is resolved **for the ten accepted World mints under the current pinned policy**, using the public RPC transaction archive and reconciliation with surviving accounts. The earlier [snapshot-only output](../measurement/game-metrics.json) remains unchanged as a dated observation; this follow-up adds separate historical evidence.

## Verified scope and result

The collector retrieved **191 finalized program-address signatures**, then an empty `before` page. All **191 transactions were retrieved**, including eight failed transactions that are excluded from deposit counts. The initial successful deployment created the program account from zero lamports and executed loader `DeployWithMaxDataLen` in the same transaction: **18 August 2026, 00:01:52 UTC, slot 439949642**, [deployment transaction](https://solscan.io/tx/48LVqwGHTaRyhDFvinEmeu2EzmfFY69u2F77bqgy7oUiiZF23LjhNE5jvwcEi1gG1UBir72zRWjCMsfeSc7cM5r7). The earliest returned reference is a failed `ProgramAccountNotFound` transaction before deployment at slot 439945412. Five later upgrades and three program-data extensions are preserved; this evidence is not a binary/security audit of those versions.

The history has **146 successful lock creations and seven successful claim cycles**. Claims show both the lock and token-vault accounts closed. Six physical PDA addresses were recreated after claims, so account incarnations are tracked separately rather than treating an address as a single lifetime deposit. The reconstructed open set has **139 accounts**, exactly matching the fresh finalized RPC snapshot: no missing, unexpected or mismatched accounts. All 139 surviving `Lock.created_at` timestamps also match their transaction `blockTime`.

All seven claims concerned PASTA, which is outside the ten accepted World mints. The **19 World-mint creations all survive** and have exact timestamps and balances corroborated by their lock accounts. There are no unknown Fridge instruction discriminators, missing transactions or decoder errors. A final `getSignaturesForAddress` query with the latest signature as `until` and the fresh account slot as `minContextSlot` returned no new signatures, covering the interval between discovery and reconciliation.

The fresh account response completed at **2026-10-07T11:28:22.564Z**, finalized context slot **454209595**. Signature discovery was pinned at finalized slot 454207346; its last successful referenced transaction is **1 October 2026, 20:16:04 UTC, slot 452392206**. The retrospective current-policy interval is therefore **18 August 00:01:52 UTC through 7 October 11:28:22.564 UTC**. Each counted first-loss cohort's full renewal window falls inside this interval.

| Metric | Result | Attribution |
| --- | ---: | --- |
| World-mint existing / active lock accounts | 19 / 13 | Same dated game-mint scope; six expired-unclaimed |
| Active account fraction | 68.42105263% | Account state, not a renewal percentage |
| Current wallets adopting token-gated access | 1 | Publicly labelled DevFridge treasury |
| Qualifying wallets after treasury exclusion | 0 | Wallet count; no independent human attribution |
| Fixed first-loss wallet cohort | 1 | Treasury only |
| Renewal within 7 days | 1 / 1 | **100%, internal n=1**; one matched episode |
| Renewal within 30 days | 1 / 1 | **100%, internal n=1**; two matched episodes, wallet counted once |
| Renewal cohort after treasury exclusion | 0 | **N/A / null**, not 0% and not community traction |

The cohort is fixed at each wallet's first observed loss of qualifying commitment for a particular accepted mint. Expiries must reduce the same-wallet/same-mint aggregate from at least 500,000 tokens to below that threshold; other character access may remain. A new deposit at/after expiry must restore qualification for a mint in that first-loss group within the explicitly selected inclusive window. Deposits opened before expiry and cross-mint balances do not qualify. Only completely elapsed 7/30-day windows enter the denominator. A single new lock cannot inflate several expired locks into several lock-level renewals.

The treasury's first CICCIA loss on **19 August 08:26:00 UTC** was followed by a qualifying new lock at **11:53:42 UTC** that day. Its second loss at **12:53:00 UTC** was followed by a qualifying new lock on **7 September 17:46:43 UTC**. Both windows count the same first-loss wallet once. The extra episode fits 30 days. These are inferred renewed commitments, not an explicit renew instruction or proof that the old funds were recycled.

Adoption is defined as qualifying active accepted-mint wallets, independent of played rounds. This archive cannot create independent adopters where none were observed. Treasury activity is real on-chain evidence but is not independent market demand. It also does not establish an eligible Android live round, a positive SKR unlock, a wallet consent prompt or Android attribution.

## Completeness boundary

Completeness is supported by one public RPC archive, pagination through the program's initial deployment, retrieval and decoding of every returned transaction, recovery of all claim cycles and exact final-state reconciliation. The provider remains the source of ledger history; this is not a separate archival-validator audit. The mainnet genesis hash was verified.

The **current** policy `devfridge-world-current-access-5d9ab246` is applied uniformly to archived timestamps. Historical game policy versions are not reconstructed; one-hour August locks are not claimed to have passed the older SDK one-day plan. Shared-program locks also contain no on-chain GameID, so matching a policy does not prove why a holder locked tokens or make overlapping game counts additive.

For claimed **non-game** locks, `transaction.blockTime` is retained as the creation-time estimate because exact closed-account `Clock` data did not survive. This utility does **not** calculate a complete protocol-wide historical renewal rate from those estimates. In this actual archive, none of the accepted World-mint locks were claimed; all 19 game timestamps are instead exact surviving account values. If a future archive includes a claimed World-mint lock without exact historical account data, the coverage guard returns unavailable.

The imported snapshot-only `perGameLockMetrics` output retains its generic `historicalClosedAccountCoverage: unknown` limitation because a standalone account snapshot cannot establish history. The separate `completeGameHistoryUnderCurrentPolicy`, raw archive and reconciliation establish this follow-up's history coverage. The historical renewal function receives explicit provenance through that verified pipeline; a manually supplied coverage declaration alone is not independent proof.

## Reproduction and privacy

The collectors use Node 20+ with built-in modules only. The following offline test-runner commands were tested on Node 24.18.0 and perform no network calls:

```powershell
node --test --test-isolation=none history.test.mjs
node verify-history.mjs
node decode-history.mjs
node reconcile-history.mjs --offline
```

Sixteen tests use labelled synthetic fixtures to exercise actual-vault amounts, values above JavaScript's safe-number precision, versioned loaded addresses, CPI instructions, failed transactions, unknown instructions, deployment origin, account mismatches, claims, PDA reuse and incomplete-coverage guards. The offline verifier checks all receipt hashes, read-only method/endpoint restrictions, signature identities, decoding, initial deployment, account reconciliation and independently reruns the imported metrics against their inputs. These tests validate evidence handling; they do not certify program security.

To collect a fresh archive, use a **new** output directory and preserve these dated receipts:

```powershell
node collect-history.mjs ./fresh-receipts
node collect-transactions.mjs ./fresh-receipts
node decode-history.mjs ./fresh-receipts
node reconcile-history.mjs ./fresh-receipts
node verify-history.mjs ./fresh-receipts
```

Collection reads public unauthenticated JSON-RPC only. It sets no cookies, requests no signatures, sends no transactions, reads no provider keys, and creates no game telemetry or test adopters. Public wallet addresses are pseudonymous. [Receipt summary](receipts/history-summary.json), [transaction manifest](receipts/transactions-manifest.json), [decoded instruction history](receipts/decoded-history.json) and [fresh account snapshot](receipts/fresh-decoded-locks.json) preserve method, filters, timestamps and chain slots.

Source references and normalized SHA256 pins: [source manifest](sources-manifest.json), [pinned Fridge interface/program](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/programs/fridge/src/lib.rs), [pinned IDL](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/idl.json), [public proxy read methods](https://github.com/mikeminer/devfridge/blob/2e0064cc37f21187bd89c0e3768f3257000c3fdb/scan/lib/rpc-proxy.ts), [current policy](../measurement/game-policy.json), [Solana signature pagination](https://solana.com/docs/rpc/http/getsignaturesforaddress), [transaction retrieval](https://solana.com/docs/rpc/http/gettransaction) and [loader deployment account references](https://docs.rs/solana-loader-v3-interface/9.0.0/solana_loader_v3_interface/instruction/enum.UpgradeableLoaderInstruction.html).
