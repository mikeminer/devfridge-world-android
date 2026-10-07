# Clock In candidate writeup — 7 October 2026

This update adds a dated public on-chain baseline to the Android evidence. It preserves the scope of the original beta.1 video, the later debug native SKR diagnostic and the signed beta.2 release. It makes no new Android-runtime or independent-player claim.

## Portal porting-features field

Problem: Solana community players need short game sessions they can play, pause and share on a phone. Small browser controls, wallet handoffs and lost session context interrupt that loop. DevFridge World preserves Three.js/Rapier 3D merge play and adds Kotlin MWA authorization/exact-message signing, larger touch targets, haptics preferences, native sharing and lifecycle recovery.

The live loop connects a Solana community identity to the playable cast: the selected character's mint must have at least 500,000 actively timelocked tokens, summed in exact raw units for the authorized wallet. The existing backend checks access and verifies completed runs; optional seasonal TopShelf registration links the original Solana authorization to a separate Robinhood/EVM account. A labelled 60-second practice round teaches the pinned engine without a wallet or lock. Isolated storage and bridge restrictions keep practice outside signing, ranked registration and prizes.

Cookie-free on-chain baseline, 7 October 2026: confirmed Solana slot 454175939 has 139 existing locks, 84 active, 4 depositors and 21 mints. The 10 character mints have 19 locks/13 active; the sole eligible wallet is the public treasury (0 external after exclusion). TopShelf creation-to-snapshot logs show 15 registrations on 7 UTC dates, 10-30 September, all by the contract owner linked to that treasury. This proves protocol/access and repeated owner registration activity; unregistered play, Android usage and external-player retention are not established. Definitions, raw responses, block/slot coverage and reproduction: https://github.com/mikeminer/devfridge-world-android/blob/main/ONCHAIN-METRICS-2026-10-07.md .

Recent sessions keeps 20 completed local results with mode/time, same-mode replay goals and clear/empty/error states. The on-device coach adapts tips to scores, collection progress and voluntary helpfulness ratings. This is working adaptive personalization, not a generative AI service. History and coaching feedback stay on-device; repeated local usage and Android retention have not been measured.

Recorded Android 15/API 35 beta.1 execution: touch fusion showed MERGED Aperitivo and score 20; completion displayed adaptive advice. Home/return paused play and Resume recovered it. ACTION_SEND delivered the actual 1080x1350 score PNG to a local test receiver with temporary read permission. Force-stop/reopen retained best 20 and session history. The actual 2:49 recording: https://youtube.com/shorts/LRDAhJhFfLI . It records beta.1 debug; signed beta.2 has no new recorded execution.

The separate official SDK FakeWallet diagnostic used unfunded test keys. MWA authorized an account and signed a message binding domain, account, nonce, issue time and diagnostic purpose. Independent Ed25519 verification passed for its 64-byte signature. This proves diagnostic signing, not live access, a ranked score or payment.

The video's native SKR consent/query ended in a retryable DNS failure. On 6 October at 15:26 UTC, repaired guest Wi-Fi enabled a real mainnet request using unchanged readSkrAccounts on installed debug beta.1/code 8: parsed accounts 0, filtered raw SKR 0, eligibility false, no mocked response. This proves native network/parser success, without a new wallet or visible result-dialog run. Malformed records are skipped; raw RPC count/status/slot were not exported. Optional positive SKR holdings enable only the Aurora session cosmetic. No positive SKR/Aurora or eligible completed live Android round is recorded. Debug trust configuration is distinct from release TLS. Receipts: https://github.com/mikeminer/devfridge-world-android/blob/main/evidence/2026-10-06/EMULATOR-NETWORK-FIX.md .

Developer triage covers all 17 unconfirmed audit leads and their source/test boundaries. Beta.2 removes three transitive exported AndroidX test activities from the release manifest; other leads remain source assessments rather than independent clearance. Details: https://github.com/mikeminer/devfridge-world-android/blob/main/SECURITY-TRIAGE-2026-10-06.md .

Public source/build: https://github.com/mikeminer/devfridge-world-android . Beta.1 passed 38 JS tests (3 generated-bundle skips), 11 JVM tests, debug lint and debug/release assembly. sharp/Vite and CLI/glob advisories were remediated; the dated npm audit reports zero known advisories in the checked tree. Beta.2 source f2408f43af4446bcd082c93574f14c6f24eb3af6 passed 11 JVM tests, release lint (0 errors/19 warnings) and assembly; compiled classes and 89 game assets match beta.1.

Publisher-signed beta.2/code 9: 65,775,562 bytes; SHA256 d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774; v3 signing verified; HTTPS download 200. The release retains its certificate and excludes emulator CA. Production assetlinks.json returned 200 with that certificate. Source/signing, DAL, build and runtime receipts: https://github.com/mikeminer/devfridge-world-android/blob/main/ANDROID-EVIDENCE-2026-10-06.md .

## Evidence interpretation

The live community loop is wallet-selected character access through existing Solana timelocks, server verification of live runs and optional seasonal score registration on Robinhood Chain. Local practice supplies onboarding and on-device improvement without satisfying the live gate.

[On-chain metrics, definitions and raw receipts](ONCHAIN-METRICS-2026-10-07.md) distinguish ecosystem depositors, wallets meeting the character-token threshold and optional registered-score participants. Repeated owner registrations are published as owner activity. Neither a continuously active timelock nor repeated owner use establishes independent-player retention. Public chain events do not identify Android versus browser play, and unregistered local play is outside the measured set.

[Android observations](ANDROID-EVIDENCE-2026-10-06.md), [native network follow-up](evidence/2026-10-06/EMULATOR-NETWORK-FIX.md) and [source triage](SECURITY-TRIAGE-2026-10-06.md) remain separate evidence sources. The original [6 October writeup](CLOCK-IN-WRITEUP-2026-10-06.md) is retained as a dated prior version.

This text is within the portal's 5,000-character field limit. A local copy does not itself establish that the portal draft was saved.

