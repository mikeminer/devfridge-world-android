# DevFridge World for Android

The app bundles DevFridge World's Three.js/Rapier game and adds Kotlin Mobile Wallet Adapter authorization and signing, touch input, optional haptics, native sharing, lifecycle handling, local coaching and recent-session history. Its public origin is [world.devfridge.cool](https://world.devfridge.cool).

The current downloadable tester release is **0.3.2-beta.2 / versionCode 9**. It removes three unnecessary transitive AndroidX test activities from the release manifest; its compiled classes and game assets are unchanged from beta.1. The recorded emulator/video evidence and later native network diagnostic used the installed **beta.1 debug / code 8** app, not a newly executed beta.2 release.

The app offers separate native menu entries for local practice and the live token-timelock game. Local practice uses an actual 3D physics engine with 60 seconds of active play, isolated storage and an explicit local/unranked result. It requires no wallet or lock. Practice cannot authorize a wallet connection, message signature or registration through the game bridge, and its scores carry no leaderboard entry or prize eligibility. The optional native SKR menu check is a separate disclosed read-only action.

## Build from this repository

Requirements: Node.js 22+, JDK 17, Android SDK platform 36 and build tools 36.0.0. Android 9 or newer is required for installation.

From the repository root:

```powershell
node scripts/fetch-game-assets.mjs
Set-Location android
npm ci --no-audit --no-fund
npm run prepare:game
npm test
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug :app:assembleRelease
```

Set `ANDROID_HOME` to the SDK location or create an untracked `android/local.properties` with `sdk.dir=...`. `app/build/outputs/apk/debug/app-debug.apk` is debug-signed. Default release assembly is unsigned; no publisher signing key is included in this repository.

`prepare:game` packages the restored `../scan/public/world/game-v2` assets and applies the documented age-gate/mobile-script overrides. The live game bundle remains pinned to its original hash. It also runs `prepare-practice.mjs`, which fetches the separately pinned demo renderer/physics distribution and applies counted, hash-checked practice adapters. The adapters isolate storage, replace the demo reset with a local completion timer, remove ranked finishing and label score sharing as practice. `game-provenance.json`, `practice-source.json` and `practice-provenance.json` record both sources and overrides. Generated assets, local SDK configuration and build outputs are ignored by Git.

The exact `?mode=practice` route is checked in `BridgePolicy`; native handling serves the local practice document without changing the production live-game page. Live eligibility, compliance and server verification retain their existing rules.

The JavaScript suite covers wallet, registration, network-failure handling, local history and practice isolation. Three generated registration-page tests run only when a built bundle from the original `cold-storage` project is supplied:

```powershell
$env:REGISTRATION_BUNDLE = 'C:\path\to\registration.js'
npm test
```

Those tests are skipped when the generated bundle is absent. On Windows environments that restrict test-worker process spawning, Node's `--test-isolation=none` can run the JavaScript tests in one process.

## Mobile and Solana behavior

MWA authorizes the selected Solana account and signs exact message bytes. Private keys remain in the wallet; the bridge provides no general transaction-signing interface. The live game and its backend verify timelock eligibility and completed runs. Optional paid TopShelf registration continues separately in Phantom on Robinhood Chain.

The [native menu](app/src/main/java/cool/devfridge/world/MainActivity.kt#L338) exposes `Local practice · no wallet or prizes` and `Live game · timelock access`. The [reference server checker](../scan/lib/topshelf/registration.ts#L33) requires 500,000 active timelocked tokens of the chosen character's mint, owned by the selected Solana wallet, summing distinct matching locks with mint decimals. Ordinary liquid token balance and the optional SKR cosmetic do not satisfy that check. This server excerpt is part of the existing production-service reference, not a standalone deployment or proof of completed eligible Android play.

Practice uses a separate exact route and document under [BridgePolicy](app/src/main/java/cool/devfridge/world/BridgePolicy.kt#L10). [Preparation adapters](scripts/prepare-practice.mjs#L23) isolate engine storage and remove ranked finishing. The [practice runtime](mobile/practice.js#L4) blocks service requests and registration, and the [native bridge](app/src/main/java/cool/devfridge/world/MainActivity.kt#L129) separately rejects practice wallet connection/signature requests. Saved practice history cannot become a server-verified live score or payment authorization.

The SKR action displays a disclosure before authorizing the wallet and requesting a read-only mainnet balance for the official mint. A positive balance enables the Aurora cosmetic for the current session. No transaction is sent, and access, scores, rankings and prizes are unaffected. The RPC provider can observe the public wallet address and IP address. A query failure is shown as unavailable rather than a zero balance or an unlocked perk.

The on-device coach selects English or Italian advice based on collection progress and recent scores, then adapts using voluntary helpfulness ratings. “Recent sessions” stores at most 20 completed results with mode and timestamp, shows a same-mode personal replay goal, and provides a clear-history action and an empty state. The native menu can open that history before a game starts. This data stays on the device; the feature is adaptive personalization, not a generative AI service or proof of measured retention.

The separate [7 October public on-chain baseline](../ONCHAIN-METRICS-2026-10-07.md) reads existing DevFridge lock accounts through mainnet RPC without browser cookies or APK session tracking. Its exact game-mint filter and treasury exclusion describe potential token-based access, not Android installs, completed games or player retention. Already-closed accounts are outside that snapshot; local recent-session history is not attributed to those chain wallets.

## Manual MWA diagnostic

`app/src/androidTest/.../ManualMwaEvidenceTest.kt` is compiled only into the instrumentation APK. It is opt-in and requires the official [Solana Mobile SDK Fake Wallet](https://github.com/solana-mobile/mobile-wallet-adapter), with newly generated unfunded test keys. The operator approves account connection and a message that explicitly identifies itself as a diagnostic. The message includes the domain, account, nonce, issue time and purpose, without authorizing game access, a ranked score or payment.

```powershell
.\gradlew.bat :app:assembleDebugAndroidTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w -e class cool.devfridge.world.ManualMwaEvidenceTest -e manualMwaEvidence true cool.devfridge.world.test/androidx.test.runner.AndroidJUnitRunner
```

The diagnostic contains visible Connect, Sign test, Check SKR and Finish controls. It exports public evidence only, including the exact signed message and signature. The independent checker validates its Ed25519 signature:

```powershell
node scripts/verify-mwa-evidence.mjs manual-mwa-evidence.json verification.json
```

The checker expects evidence explicitly marked as a diagnostic without production authorization or a financial transaction. No private key is exported.

## Testing status — 6 October 2026

The recorded beta.1 candidate passed eleven Android JVM unit tests, debug lint with zero errors, debug assembly and release assembly. The JavaScript suite passed 38 tests, with three generated registration-bundle tests skipped. Beta.2 passed all eleven JVM tests again, release assembly and release lint with zero errors and 19 warnings. Commands, version boundaries and signed artifacts are consolidated in [the Android evidence report](../ANDROID-EVIDENCE-2026-10-06.md).

On Android 15/API 35, actual touch fusion displayed “MERGED Aperitivo” and score 20, followed by a labelled “Practice complete” result. After `am force-stop` and reopening the app, the local best remained 20 and Recent sessions displayed the completed 20-point results, including the final 10:35 session. A result-layout defect and missing practice textures found during play were fixed. The Android share chooser delivered the actual 20-point practice PNG to a local test receiver: `ACTION_SEND`, `image/png`, 1080 × 1350, 272,027 bytes, with read permission granted. The receiver accepted the image; no external posting occurred. [Public share receipt](../evidence/2026-10-06/share-receipt.json).

The morning manual MWA diagnostic completed one instrumentation test with the official Fake Wallet. Connection and a 64-byte diagnostic message signature succeeded, and independent Ed25519 verification returned true. Its recorded native SKR consent/query displayed a graceful failure because emulator DNS could not resolve the mainnet RPC. The original video and failure receipt remain unchanged.

**Subsequent network result, 6 October 2026 at 15:26 UTC:** enabling guest Wi-Fi restored a validated default network, with connectivity and DNS persisting across a restart. The opt-in `EmulatorNetworkEvidenceTest` invoked the already-installed beta.1 debug/code 8 app's unchanged `readSkrAccounts` off the UI thread. A real mainnet request returned zero parsed token accounts, filtered raw SKR `0` and eligibility `false`, without a mocked response. Only the instrumentation APK was installed. [Dated report and reproduction](../evidence/2026-10-06/EMULATOR-NETWORK-FIX.md), [native JSON](../evidence/2026-10-06/native-skr-network-evidence.json) and [OK (1 test) output](../evidence/2026-10-06/emulator-native-network-test.txt) are preserved in [snapshot b4a80ef](https://github.com/mikeminer/devfridge-world-android/tree/b4a80efc7c8ffb9e30e27e0f900e580ca4002e62/evidence/2026-10-06).

This later result is native network/parser verification, not a new authorization/signature, visible SKR consent/result dialog, positive SKR/Aurora unlock or execution of the signed beta.2 release. The native function skips malformed individual accounts and does not export raw RPC array count, HTTP status or slot, so zero parsed accounts do not independently prove an empty raw RPC array. The diagnostic did not audit debug trust-store/build flags or establish release TLS behavior. No eligible completed live Android round, paid registration, physical-device/Seed Vault execution or measured retention is recorded.

The production Digital Asset Links endpoint returned HTTP 200 and the release certificate. The emulator's debug wallet identity warning remains distinct from the release identity. This PC also uses HTTPS interception: `scripts/prepare-local-emulator-tls.ps1` can validate/export its existing Windows-trusted public root for an explicitly opted-in debug build with `-PlocalEmulatorTls=true`. Those local resources are ignored and excluded from default debug and all release builds; normal TLS validation remains enabled.

Current publisher-signed tester APK: [Android 0.3.2-beta.2](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.2), code 9, source `f2408f43af4446bcd082c93574f14c6f24eb3af6`. `DevFridge-World-0.3.2-beta.2.apk` is 65,775,562 bytes with SHA-256 `d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774`; v3 signing and HTTPS download 200 were verified. It retains the existing certificate and excludes the local emulator CA. [Release receipt](../evidence/2026-10-06/beta2-release.json) and [manifest/code/asset comparison](../SECURITY-TRIAGE-2026-10-06.md) preserve the scope of this packaging follow-up. Default local Gradle assembly is not this separately signed artifact.

The [original beta.1 release](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.1) remains available: SHA-256 `7c8bfc6417c94596b11f1431741e7ff7b2eaf89236bd497a1f2228dc76c23b84`, source/evidence snapshot `de54d8736838827de79d7cef0e3fc4931bbf5839`. It identifies the original demo version; the later network test used an already-installed debug beta.1 app and is not execution of either publisher-signed APK.

## Design references

[Solana Mobile Kotlin setup](https://docs.solanamobile.com/get-started/kotlin/setup)

[Solana Mobile Kotlin quickstart](https://docs.solanamobile.com/get-started/kotlin/quickstart)

[Android WebView bridge guidance](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge)

The [published Android demo on YouTube](https://youtube.com/shorts/LRDAhJhFfLI?feature=share) is unlisted and shows actual emulator practice, sharing, restart persistence and the separate SDK test-wallet diagnostic. The [English descriptive transcript](../evidence/2026-10-06/android-demo.transcript.md), captions and source cut/hash receipt are public in this repository. Raw screen recordings and the uploaded original MP4 remain preserved locally; raw-video downloads are not published.
