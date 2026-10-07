# Android TopShelf registration handoff

The Android app preserves the game and its existing score verification. It records only matching successful live-score responses and never turns an offline or unverified run into a ranked score. Registration remains optional.

## Current flow

1. Finish a server-verified run and open Saved scores or the TopShelf registration option.
2. The game checks the configured Robinhood Chain contract for an existing registration. A run already used by the contract is not offered for another payment.
3. The Android handoff requests a short-lived server draft for the verified run. The server protects retrieval with a temporary capability; the deep link does not contain the score, ticket, wallet key, or signature.
4. The app opens the registration page in Phantom. Players may connect the same Solana account inside Phantom. On Android, a separate Use game wallet option can request authorization and the exact registration message signature from the original Solana account through Mobile Wallet Adapter, including a Seed Vault account.
5. The user reviews the selected Robinhood account, token, amount, network fee, and contract details, then separately approves any wallet prompts. The Android app does not submit a payment transaction.
6. Returning to the game does not count as payment success. The app checks the contract again and leaves uncertain results retryable.

The app never requests, imports, or exports a recovery phrase. Solana private keys remain in the wallet. Wallet signing, token allowance, and Robinhood payment are separate actions.

## Implementation and deployment

Android bridge code is in `mobile/native-bridge.js`, `mobile/native-signing.ts`, and `mobile/registration-handoff.js`. The dedicated-page bootstrap is `mobile/registration-page.ts`; it is bundled with the pre-existing registration UI in production. The server handoff and page were deployed through [devfridge PR 55](https://github.com/mikeminer/devfridge/pull/55), production commit `5e7758be59823a1f5bfa1cd32b9c78f19f73e105`.

Wallet requests use the supported KTX `timeout` parameter of 300 seconds per RPC. The JavaScript bridge allows 330 seconds for connection/disconnection and 630 seconds for message signing, which reauthorizes before its signing RPC; both budgets include 30 seconds for the native reply. Other native actions keep their 120-second deadline. These changes are implemented in the unpublished beta.3 candidate; the previously published beta.2 APK keeps its original timeouts.

A native reply clears its JavaScript timer and pending entry. A bridge timeout rejects the request and removes the pending entry, so an expired reply cannot resolve it or grant a JavaScript wallet account and a fresh request can be made. The JavaScript deadline does not itself cancel a wallet prompt or revoke an authorization. The native `walletBusy` guard is released in `finally` when the SDK operation finishes or is cancelled; current-document and account checks remain in place.

The generated production registration bundle is not stored in this repository. Therefore, three browser integration tests are skipped by default. Set `REGISTRATION_BUNDLE` to that built JavaScript file to run them. The native handoff and wallet-signing bridge tests are included in the normal Android JavaScript test suite.

## Verification limits

Android unit tests cover SKR balance filtering and native bridge policy. JavaScript tests cover the exact wallet identity, exact message bytes, refusal and error cases, persistence, and handoff state. These tests do not prove a production wallet signature or a paid on-chain registration.

The earlier emulator note about no available compatible wallet was superseded by the 6 October 2026 beta.1 debug/code 8 diagnostic: the official SDK Fake Wallet authorized an unfunded test account and returned a 64-byte diagnostic-message signature that passed independent Ed25519 verification. It was not a game-access, verified-score or payment authorization, and the recording retained the debug identity warning. A separate native network/parser test at `2026-10-06T15:26:02Z` completed a real mainnet SKR query with filtered raw balance `0` and eligibility `false`; it did not show a new wallet consent flow or Aurora unlock. See the [dated Android evidence](../ANDROID-EVIDENCE-2026-10-06.md), [signature verification](../evidence/2026-10-06/manual-mwa-verification.json) and [native network receipt](../evidence/2026-10-06/native-skr-network-evidence.json).

The current source exposes generic Solana Mainnet MWA account connection and exact-message signing through the native bridge; it checks that the requested signing account matches the wallet's authorized account. The registration page can request that original game account through the native handoff, while the optional Robinhood payment opens separately in Phantom. These interfaces support the intended original-wallet path, including an MWA-compatible Seed Vault Wallet, but source support is not a recorded physical-device execution. A live timelock-eligible Android run, purpose-specific score/registration signature, paid Robinhood registration and signed beta.2 wallet-identity verification still need their own runtime evidence.
