# Slow-wallet authorization diagnostic and beta.3 candidate

On 7 October 2026, a separate native protocol diagnostic received a successful
Mainnet-beta authorization response from the wallet identified by the test
operator as Phantom 26.31.1 on an Android 15 emulator. It requested authorization
at elapsed `8691 ms` and received the response at `120706 ms`: **112015 ms**
between request and response, exceeding the SDK's default 90000 ms RPC timeout.
This interval includes waiting for wallet approval; it is not a measurement of
network latency alone. Final capabilities returned and the association closed.
The diagnostic requested neither a message signature nor a financial transaction.

The [phase receipt](probe-300s-public.json) is an exact copy of the publication-safe
local receipt. It contains elapsed times and outcomes, without wallet addresses,
account details, balances, authorization tokens, keys, screenshots or raw SDK logs.
Its SHA256 is `53fcb0dd7f02fb238a262489bc9576a9fb68ddd53c0fcd42d7aadc55f3c3f9aa`.

This was a separate instrumentation driver using the installed World Activity's
association launcher, existing identity and SDK 2.0.7 Java client with a supported
300000 ms RPC timeout. It sent a fresh legacy `cluster: mainnet-beta` authorization
request without a prior token. It does not exactly reproduce the game's KTX/V1
`chain: solana:mainnet` flow. The successful diagnostic supports allowing more
time for approval; it does not establish successful game authorization, game
message signing, timelock-eligible play or the cause of every earlier failure.

The [candidate provenance](candidate-v2-provenance.json) records the separately
built local cancellation-recovery candidate v2 at
`deliverables/DevFridge-World-0.3.2-beta.3.apk`, outside this repository. Package
`cool.devfridge.world`, version `0.3.2-beta.3`, code `10`, APK SHA256
`20de2863c186c5840989fea8e7e0261ac27258a40a9274ac9e96bedbb3490160`.
The existing publisher certificate and APK v3 signature were verified.

At the recorded build/check time, this candidate was **unpublished** and built
from base commit `bbb9125c3cc84953d1403d02d4543a70d68e9e62` plus tracked working-tree
changes. Four LF-normalized source hashes and the compiled-class hash identify
that original build. The four recorded source files subsequently match
[source commit `d7617b577ee137792895c75706fe9358cbd7e363`](https://github.com/mikeminer/devfridge-world-android/commit/d7617b577ee137792895c75706fe9358cbd7e363)
exactly after LF normalization, including the tracked Android build configuration,
native bridge, MainActivity and BridgePolicy. The original base commit and dirty
build state remain recorded; this same APK was not rebuilt at the subsequent
commit. It remains a local unpublished candidate. The v2
receipts record **34 static boundary checks, 55 JavaScript tests and 18 release
JVM tests passing**, with zero failed/skipped tests, successful release assembly
and lint. Static checks bind prepared assets and compiled classes to this exact
signed APK. The provenance also records the original v1 candidate hash separately;
its earlier receipts were preserved.

A later candidate-v2 UI follow-up was reported by the operator: wallet consent
and error states around 17:00, then interface recovery by 17:01 on 7 October.
These approximate clock times carry no inferred timezone or causal timing claim.
No successful game-message signature was established. Recovery after an error
does not prove that cancellation caused the failure. The public provenance
contains only this sanitized observation; private wallet screenshots and raw logs
are not included.

The source allows 300 seconds per wallet RPC, 330 seconds in the bridge for
connection/disconnection, and 630 seconds for sequential reauthorization/signing.
Other native actions retain 120 seconds. Cancellation tests check defensive
cleanup semantics; they do not prove the cause of the observed signing failure.
Build and fixture results are separate from live execution. These receipts do
not claim a successful Android game signature, positive SKR/Aurora, physical
Seed Vault execution, a paid entry or a completed timelock-eligible Android round.
