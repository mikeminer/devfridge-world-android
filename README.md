# DevFridge World Android

DevFridge World brings a Three.js/Rapier physics game to Android with Kotlin Mobile Wallet Adapter authorization and exact-message signing, touch controls, optional haptics, native sharing, lifecycle handling, saved server-verified runs, local session history and an optional read-only SKR cosmetic check.

The app is for Solana community players who want short, playable sessions and a familiar wallet on their phone. The Android layer addresses small browser controls, interrupted wallet handoffs and friction when keeping or sharing a completed run. A local practice mode provides a way to learn the game before choosing token-timelock access to the live game. Character eligibility and optional paid TopShelf registration remain separate from practice.

**Network follow-up, 6 October 2026:** after guest Wi-Fi was enabled, the installed beta.1 debug app completed a live native SKR request at 15:26 UTC, returning zero parsed token accounts and filtered raw balance `0`. This subsequent instrumentation result is separate from the earlier video's DNS failure and does not demonstrate a positive SKR balance, a new wallet/UI flow or execution of the signed beta.2 release. [Dated result and reproduction](evidence/2026-10-06/EMULATOR-NETWORK-FIX.md).

This focused repository started as an export from [mikeminer/devfridge at 10ec57e](https://github.com/mikeminer/devfridge/tree/10ec57e6076c7f132757b76e3d9c4570733efc83), with the original development history in [PR 113](https://github.com/mikeminer/devfridge/pull/113). Subsequent commits contain dependency remediation and Android 0.3.2-beta.1 development. It excludes unrelated monorepo projects and restores large game media through hash-checked asset fetchers.

## Build the Android app

Requirements: Node.js 22+, JDK 17, Android SDK platform 36 and build tools 36.0.0. Set `ANDROID_HOME` or create `android/local.properties` with your SDK path. Installation requires Android 9 or newer.

```powershell
node scripts/fetch-game-assets.mjs
Set-Location android
npm ci --no-audit --no-fund
npm run prepare:game
npm test
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleRelease
```

`prepare:game` packages the pinned live-game distribution and fetches/prepares the separate practice distribution. Both fetchers validate source-file bytes and SHA-256 hashes. `android/game-provenance.json` records live assets and mobile overrides; `android/practice-source.json` pins the practice source, and `android/practice-provenance.json` records its explicit adapters. The practice preparation fails when the reviewed source hash or expected patch boundaries differ.

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Default release assembly creates an unsigned artifact; publisher signing is a separate step. Signing keys, credentials, local SDK paths, generated assets and local emulator certificates are excluded from Git. [Android build and testing details](android/README.md) cover the optional manual MWA diagnostic and generated registration-page tests.

## Mobile experience and local progression

Version 0.3.2-beta.1 adds a native menu route to a clearly labelled 60-second local practice mode. It uses the actual pinned 3D renderer and physics engine, with explicit adaptations for local completion, isolated engine storage and practice-labelled sharing. The native route is the exact first-party game URL with `?mode=practice`. Practice page requests cannot authorize wallet connections, signatures or TopShelf registration through the native bridge. Practice scores cannot enter a verified leaderboard or claim prizes. The live game retains its compliance and token-timelock access checks.

Live access connects a character to its Solana community mint. The [reference server's timelock checker](scan/lib/topshelf/registration.ts#L33) sums distinct, unexpired locks belonging to the selected wallet and matching that character's mint, requiring 500,000 tokens with the mint's decimals applied. This is an eligibility rule, not evidence that a live Android round was completed. The [native mode menu](android/app/src/main/java/cool/devfridge/world/MainActivity.kt#L338) keeps it separate from practice. The [practice preparation](android/scripts/prepare-practice.mjs#L23) isolates engine storage and removes ranked finishing; [practice runtime restrictions](android/mobile/practice.js#L4) block service requests and registration, while [native bridge checks](android/app/src/main/java/cool/devfridge/world/MainActivity.kt#L129) independently refuse practice wallet/signing requests. A local practice score therefore cannot supply the verified run needed by the [optional registration handoff](android/MOBILE-REGISTRATION.md).

“Recent sessions” is available from the native menu, game menu and result screen. Up to 20 completed local results, their mode and completion time stay on this device. A personal replay goal compares scores in the same mode. Fresh installations show an empty state; the player can clear recent sessions, and storage failures are visible. This is an implemented reason to return, not measured retention or evidence of a player community.

The on-device coach selects localized tips from recent scores and collection progress, then adapts using optional helpfulness ratings. It is lightweight adaptive personalization rather than a generative AI service. Session history and coaching feedback are not sent to a model provider.

## Solana and optional TopShelf

The selected wallet retains its private key. The Android bridge supports account authorization and exact-message signing through MWA, without exposing a general transaction-signing interface. Live eligibility and server-verified runs continue to use the existing backend.

After disclosure and consent, the optional SKR flow authorizes a selected Solana account and queries the official SKR mint on mainnet. A positive balance enables the Aurora cosmetic for the session. No transaction is sent; access, scores, rankings and prizes are unaffected. The RPC provider can observe the public wallet address and IP address.

TopShelf remains an optional, separate Robinhood/EVM flow in Phantom. It may charge a registration fee and offer seasonal token prizes under its rules. Local practice creates neither an eligible run nor a payment authorization. [Mobile registration architecture](android/MOBILE-REGISTRATION.md) describes the original-wallet authorization and saved-run handoff.

## Public on-chain access baseline — 7 October 2026

A cookie-free public mainnet RPC snapshot at `2026-10-07T08:58:15Z`, confirmed slot `454175939`, found 139 recognized existing DevFridge lock accounts: 84 active and 55 expired but unclaimed, across four depositor wallets and 21 mints. Filtering the exact ten game mints produced 19 existing locks, 13 active, with one depositor meeting the 500,000-token timelock threshold. That wallet is the labelled public treasury; excluding it leaves **zero external wallets meeting the game's token threshold** at this snapshot.

This is a verifiable ecosystem/access baseline, collected without browser cookies or APK session tracking. It establishes neither Android installs nor completed games, independent players or retention. Already-closed lock accounts are absent, so these counts are not lifetime participation totals. Local session history remains separate on-device evidence. [Dated method, source and raw receipts](ONCHAIN-METRICS-2026-10-07.md) document the snapshot and exclusions.

The same report verifies all 15 TopShelf `ScoreRegistered` events from contract creation through Robinhood block `82351824`. They occurred on seven UTC dates between 10 and 30 September 2026, all from the current contract owner linked to the labelled Solana treasury. Separate pinned-state reads confirm season 1, one participant and 15 registrations. This establishes real on-chain registration and repeated publisher activity; excluding the owner leaves zero registered participants in that interval. These events do not identify Android versus browser use or independent-player retention. [Current submission writeup](CLOCK-IN-WRITEUP-2026-10-07.md) preserves these attributions.

## Source map

| Behavior | Source |
| --- | --- |
| Android WebView, MWA, share chooser, lifecycle, haptics and mode menu | `android/app/src/main/java/cool/devfridge/world/MainActivity.kt` |
| Trusted origin, exact practice route and bridge limits | `android/app/src/main/java/cool/devfridge/world/BridgePolicy.kt` |
| SKR mint and positive raw token-balance check | `android/app/src/main/java/cool/devfridge/world/SkrBalance.kt` |
| Wallet bridge, controls and cosmetic state | `android/mobile/native-bridge.js` |
| Local adaptive advice and recent-session history | `android/mobile/adaptive-coach.js` |
| Practice timer, completion and API isolation | `android/mobile/practice.js` |
| Saved verified runs and registration handoff | `android/mobile/registration-handoff.js`, `android/mobile/native-signing.ts` |
| Android touch and result/history styles | `android/mobile/android.css` |
| Asset provenance and explicit mobile adapters | `android/scripts/prepare-game.mjs`, `android/scripts/prepare-practice.mjs` |
| Reference live-game source | `world-game-v2/src/` |
| Existing server compliance and TopShelf excerpts | `scan/app/api/world/`, `scan/lib/topshelf/` |
| JavaScript, JVM and instrumentation tests | `android/tests/`, `android/app/src/test/`, `android/app/src/androidTest/` |

The server files are reference excerpts that depend on the original monorepo; this export is not a standalone server deployment. Android uses the existing production service. The optional Robinhood/EVM registration-page build also depends on the original `cold-storage` source. Its three generated-bundle tests are skipped unless `REGISTRATION_BUNDLE` is supplied.

## Recorded evidence and limits — 6 October 2026

The recorded beta.1 development build passed 11 Android JVM unit tests, debug lint with zero errors, debug assembly and release assembly. The JavaScript suite passed 38 tests; three generated registration-bundle tests remain skipped. For the beta.2 release-manifest follow-up, all 11 JVM tests, release lint with zero errors and release assembly passed again. The [Android evidence report](ANDROID-EVIDENCE-2026-10-06.md) records the commands, artifacts and actual emulator checks.

An Android 15/API 35 emulator ran the actual practice engine: touch fusion displayed “MERGED Aperitivo” and score 20, followed by a labelled “Practice complete” result. After force-stopping and reopening the app, the local best remained 20 and Recent sessions showed the completed 20-point results. Result-layout and texture defects found during play were corrected. The native share chooser delivered the actual 20-point PNG to a local Android test receiver, which read the 1080 × 1350 image with its temporary URI permission. Nothing was posted externally. The full live eligible-game flow remains unverified.

The opt-in `ManualMwaEvidenceTest` completed one instrumentation test on API 35 using the official Solana Mobile SDK Fake Wallet and unfunded test keys. It connected through the app's actual wallet bridge and signed a purpose-specific diagnostic message containing the domain, account, nonce and issue time. The returned 64-byte signature independently passed Ed25519 verification. This proves the recorded diagnostic authorization/signing flow, rather than live character eligibility, ranked score authorization or a financial transaction. No physical-device or Seed Vault execution is claimed.

In the morning recording, the real SKR disclosure and consent flow was exercised, but emulator DNS prevented a balance result. The app displayed a retryable failure without granting the cosmetic or changing access and scores. That video and its original failure receipt remain unchanged.

At `2026-10-06T15:26:02Z`, a subsequent opt-in `EmulatorNetworkEvidenceTest` passed against the already-installed debug `0.3.2-beta.1` / code 8. After guest Wi-Fi repair and a restart, the unchanged native `readSkrAccounts` completed a real mainnet request for the earlier SDK diagnostic's public account: `parsedTokenAccountCount: 0`, `rawSkrBalance: "0"`, `eligible: false`, no mocked response. The [network follow-up](evidence/2026-10-06/EMULATOR-NETWORK-FIX.md), [native receipt](evidence/2026-10-06/native-skr-network-evidence.json) and [test output](evidence/2026-10-06/emulator-native-network-test.txt) are preserved in [snapshot b4a80ef](https://github.com/mikeminer/devfridge-world-android/tree/b4a80efc7c8ffb9e30e27e0f900e580ca4002e62/evidence/2026-10-06). This establishes native network/parser success, not a new authorization/signature, visible SKR consent/result dialog or beta.2 release execution. The parser skips malformed individual records and does not expose raw RPC array count, HTTP status or slot. Zero parsed records therefore do not independently prove an empty raw RPC array. This diagnostic did not audit debug trust-store/build flags or establish release TLS behavior.

Positive SKR/Aurora verification, an eligible completed live Android round, physical-device/Seed Vault execution and measured retention remain unproven. The production Digital Asset Links endpoint returned HTTP 200 with the release certificate; the recorded debug identity warning remains distinct from that release association.

The original [Clock In audit](CLOCK-IN-AUDIT-7ff05bc.md) applies to commit `7ff05bc`, with incomplete coverage and 18 findings. Dependency remediation through `8f03b16` produced a dated `npm audit` result with zero known advisories in the reference web-tool dependency tree. [Dependency evidence](DEPENDENCY-EVIDENCE-2026-10-06.md) and [security follow-up](SECURITY-REVIEW.md) preserve the upgrade and remaining source-review boundaries. This is not a new independent program audit or proof of complete security.

Official app page: [world.devfridge.cool/android](https://world.devfridge.cool/android).

Current tester release: [Android 0.3.2-beta.2](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.2), version code 9, source `f2408f43af4446bcd082c93574f14c6f24eb3af6`. The publisher-signed APK is 65,775,562 bytes with SHA-256 `d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774`; download returned HTTPS 200. It retains the existing release certificate and excludes the local emulator CA. Beta.2 removes three transitive AndroidX instrumentation activity declarations only from the release manifest. Its compiled classes and all 89 game assets are byte-identical to beta.1. Release lint passed with zero errors and the eleven JVM tests passed. [Source triage and packaging evidence](SECURITY-TRIAGE-2026-10-06.md) cover all 17 unconfirmed audit locations and this additional hardening; they do not establish full security.

The original runtime/demo evidence was captured with beta.1, source/evidence snapshot `de54d8736838827de79d7cef0e3fc4931bbf5839`. That [original beta](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.1) and its SHA-256 `7c8bfc6417c94596b11f1431741e7ff7b2eaf89236bd497a1f2228dc76c23b84` remain available. No new wallet/device execution is claimed for the manifest-only follow-up.

The [published Android demo on YouTube](https://youtube.com/shorts/LRDAhJhFfLI?feature=share) is unlisted and shows actual emulator practice, sharing, restart persistence and the separate SDK test-wallet diagnostic. The [English descriptive transcript](evidence/2026-10-06/android-demo.transcript.md), captions and source cut/hash receipt are public in this repository. Raw screen recordings and the uploaded original MP4 remain preserved locally; raw-video downloads are not published.
