# Clock In candidate writeup — 6 October 2026

## Project description

DevFridge World is a short-session physics game for Solana communities on Android. Players merge familiar meme characters in a 3D fridge, build a collection and improve their personal scores. On a mobile browser, small controls, wallet switching and interrupted sharing make that loop cumbersome. The Android app keeps the existing Three.js/Rapier game while adding native touch targets, haptics preferences, wallet selection, sharing, lifecycle handling and local progress that a player can reopen on the same device.

Version 0.3.2-beta.1 provides two clearly separate experiences. Local practice is a 60-second round using the actual pinned 3D renderer and physics engine, with isolated storage and an explicit unranked result. It needs no wallet or token lock, cannot submit a ranked run and grants no prize eligibility. The live game retains its existing compliance and Solana token-timelock checks: an eligible community token lock unlocks the corresponding character. This gives a new player a way to learn the game before choosing live community access, with the commitment and financial flows kept separate from practice.

The Android Solana layer uses Kotlin Mobile Wallet Adapter to authorize the selected account and sign exact purpose-specific messages while keys stay in the wallet. Optional SKR checking uses a consent disclosure and a read-only query for the official SKR mint on Solana mainnet. A positive balance enables only the Aurora cosmetic for the session; it does not change eligibility, scores, ranking or prizes. Optional paid TopShelf registration is a separate Robinhood/EVM flow in Phantom, using the original Solana wallet for its authorization. Practice creates no eligible score or payment authorization.

The app adds a local return loop through recent sessions and adaptive coaching. Up to 20 completed results with their mode and timestamp stay on the device, with a personal goal based on the same mode, a fresh-install empty state and a clear-history action. Local tips adapt to score/collection progress and voluntary helpfulness ratings. This is a working personalization algorithm rather than a generative AI service, and the project makes no measured user-retention or community-traction claim.

The new evidence separates actual execution from automated tests. On an Android 15/API 35 emulator, actual touch fusion showed “MERGED Aperitivo” and score 20, followed by a labelled “Practice complete” result and on-device adaptive advice. Returning from Android Home paused the round, which resumed. After force-stopping and reopening the app, the local best remained 20 and Recent sessions displayed completed 20-point results, including the final 10:35 session. Result-layout and texture defects found during play were fixed. Android's native share chooser delivered the actual 20-point practice PNG to a local test receiver with temporary URI read permission; it accepted the 1080 × 1350 image and recorded its hash. Nothing was posted externally. The 2:48.700 Android recording preserves actual source frames and actions at their original speed, with a visibly marked later sharing retry and separate wallet segment. The combined recording is published as an unlisted YouTube video. An opt-in instrumentation diagnostic completed with the official Solana Mobile SDK Fake Wallet and unfunded test keys: real account authorization and a 64-byte signature succeeded, and independent Ed25519 verification returned true. Its message includes the domain, account, nonce, issue time and diagnostic purpose. It authorizes neither game eligibility, a ranked score nor a financial transaction.

The native SKR disclosure and consent were followed by a real query attempt, but emulator DNS prevented a balance result. The app showed a retryable failure without unlocking a perk or changing access and scores. Positive SKR balance verification, an eligible completed live Android round, paid registration and physical Seed Vault execution remain unproven. The production Digital Asset Links endpoint now returns HTTP 200 with the release certificate; the recorded debug identity warning remains visible and is not described as production identity verification.

The focused public repository contains Android/native source, bridge code, practice adapters, tests, asset provenance and reproducible build instructions, with the original development history linked. Eleven JVM unit tests, debug lint with zero errors and debug/release assembly passed; the JavaScript suite passed 38 tests with three generated registration-page tests skipped. Dependencies affected by the original audit's sharp/Vite findings were upgraded, and the remaining vulnerable CLI/glob-parser chain was removed. The dated npm registry audit reports zero known advisories in the updated reference web-tool tree, and six real optimized model outputs matched the prior CLI byte for byte. The original audit remains a partial source review, not a program-security clearance.

## Candidate receipts

Source repository: https://github.com/mikeminer/devfridge-world-android

Original development history: https://github.com/mikeminer/devfridge/pull/113

Implementation commit used for this candidate: https://github.com/mikeminer/devfridge-world-android/commit/a3226bb1349bbdbf1638426e3542f17affd9a7f1. Published APK/source/evidence snapshot: https://github.com/mikeminer/devfridge-world-android/commit/de54d8736838827de79d7cef0e3fc4931bbf5839. This documentation follow-up changes no app code or signed APK.

Android evidence: https://github.com/mikeminer/devfridge-world-android/blob/main/ANDROID-EVIDENCE-2026-10-06.md

Dependency remediation: https://github.com/mikeminer/devfridge-world-android/blob/main/DEPENDENCY-EVIDENCE-2026-10-06.md

Published beta APK release: https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.1

Publisher-signed APK: `DevFridge-World-0.3.2-beta.1.apk`, SHA-256 `7c8bfc6417c94596b11f1431741e7ff7b2eaf89236bd497a1f2228dc76c23b84`; the published APK download was verified HTTP 200 on 6 October 2026. The existing release certificate is retained and local emulator CA resources are excluded.

Android demo page: https://world.devfridge.cool/demo. The published recording is also available directly on YouTube below.

Published Android recording: https://youtube.com/shorts/LRDAhJhFfLI?feature=share (unlisted, displayed duration 2:49). Original upload source: 168.700 seconds; SHA-256 `3b02733967e6d33351f37eae35265220e2de971222f86747095655f3deadd9ad`. This hash identifies the preserved local MP4, not the YouTube-transcoded video. Raw source clips are preserved locally; their hashes and cut times are public, but raw-video downloads are not published.

Readable English transcript, 15 descriptive SRT cues and original source cut/hash receipt: https://github.com/mikeminer/devfridge-world-android/tree/main/evidence/2026-10-06. SRT SHA-256 `2393ea77bf2848231646afca83c3e2c955d34b126d8dc32011285e94b19324df`; transcript SHA-256 `13e1d778a3af42421dc1d2f7f52915503de76575729078716c99c4a3cf39551c`.

Public wallet signature and native share receipts: https://github.com/mikeminer/devfridge-world-android/tree/main/evidence/2026-10-06

Runtime captures: https://github.com/mikeminer/devfridge-world-android/tree/main/evidence/2026-10-06 — actual touch score 20, completed result, native PNG receiver and persisted history after force-stop/reopen.
