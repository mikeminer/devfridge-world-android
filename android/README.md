# DevFridge World for Android

The app bundles DevFridge World's Three.js/Rapier game and adds Kotlin Mobile Wallet Adapter authorization and signing, touch input, optional haptics, native sharing, lifecycle handling, local coaching and recent-session history. Its public origin is [world.devfridge.cool](https://world.devfridge.cool).

Version 0.3.2-beta.1 offers separate native menu entries for local practice and the live token-timelock game. Local practice uses an actual 3D physics engine with 60 seconds of active play, isolated storage and an explicit local/unranked result. It requires no wallet or lock. Practice cannot authorize a wallet connection, message signature or registration through the game bridge, and its scores carry no leaderboard entry or prize eligibility. The optional native SKR menu check is a separate disclosed read-only action.

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

The SKR action displays a disclosure before authorizing the wallet and requesting a read-only mainnet balance for the official mint. A positive balance enables the Aurora cosmetic for the current session. No transaction is sent, and access, scores, rankings and prizes are unaffected. The RPC provider can observe the public wallet address and IP address. A query failure is shown as unavailable rather than a zero balance or an unlocked perk.

The on-device coach selects English or Italian advice based on collection progress and recent scores, then adapts using voluntary helpfulness ratings. “Recent sessions” stores at most 20 completed results with mode and timestamp, shows a same-mode personal replay goal, and provides a clear-history action and an empty state. The native menu can open that history before a game starts. This data stays on the device; the feature is adaptive personalization, not a generative AI service or proof of measured retention.

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

Eleven Android JVM unit tests, debug lint with zero errors, debug assembly and release assembly passed. The JavaScript suite passed 38 tests, with three generated registration-bundle tests skipped. Commands and candidate artifacts are consolidated in [the Android evidence report](../ANDROID-EVIDENCE-2026-10-06.md).

On Android 15/API 35, actual touch fusion displayed “MERGED Aperitivo” and score 20, followed by a labelled “Practice complete” result. After `am force-stop` and reopening the app, the local best remained 20 and Recent sessions displayed the completed 20-point results, including the final 10:35 session. A result-layout defect and missing practice textures found during play were fixed. The Android share chooser delivered the actual 20-point practice PNG to a local test receiver: `ACTION_SEND`, `image/png`, 1080 × 1350, 272,027 bytes, with read permission granted. The receiver accepted the image; no external posting occurred. [Public share receipt](../evidence/2026-10-06/share-receipt.json).

The manual MWA diagnostic completed one instrumentation test with the official Fake Wallet. Connection and a 64-byte diagnostic message signature succeeded, and independent Ed25519 verification returned true. The native SKR consent/query attempt displayed a graceful failure because emulator DNS could not resolve the mainnet RPC. No positive SKR balance proof, eligible live completed run, paid registration or physical Seed Vault execution is recorded.

The production Digital Asset Links endpoint returned HTTP 200 and the release certificate. The emulator's debug wallet identity warning remains distinct from the release identity. This PC also uses HTTPS interception: `scripts/prepare-local-emulator-tls.ps1` can validate/export its existing Windows-trusted public root for an explicitly opted-in debug build with `-PlocalEmulatorTls=true`. Those local resources are ignored and excluded from default debug and all release builds; normal TLS validation remains enabled.

The publisher-signed `DevFridge-World-0.3.2-beta.1.apk` retains the existing release certificate and excludes the local emulator CA. Its SHA-256 is `7c8bfc6417c94596b11f1431741e7ff7b2eaf89236bd497a1f2228dc76c23b84`. Published tester beta: [Android 0.3.2-beta.1](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.1). The published APK download was verified HTTP 200 on 6 October 2026; release source/evidence snapshot is `de54d8736838827de79d7cef0e3fc4931bbf5839`. Default local Gradle output is not that signed artifact.

## Design references

[Solana Mobile Kotlin setup](https://docs.solanamobile.com/get-started/kotlin/setup)

[Solana Mobile Kotlin quickstart](https://docs.solanamobile.com/get-started/kotlin/quickstart)

[Android WebView bridge guidance](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge)

The [published Android demo on YouTube](https://youtube.com/shorts/LRDAhJhFfLI?feature=share) is unlisted and shows actual emulator practice, sharing, restart persistence and the separate SDK test-wallet diagnostic. The [English descriptive transcript](../evidence/2026-10-06/android-demo.transcript.md), captions and source cut/hash receipt are public in this repository. Raw screen recordings and the uploaded original MP4 remain preserved locally; raw-video downloads are not published.
