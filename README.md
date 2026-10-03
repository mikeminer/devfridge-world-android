# DevFridge World Android

Focused source export for the Clock In Solana Mobile hackathon. DevFridge World preserves a Three.js/Rapier physics game and adds Kotlin Mobile Wallet Adapter authorization and message signing, multitouch controls, optional haptics, Android sharing, lifecycle handling, saved server-verified runs and an optional read-only SKR cosmetic check.

This repository contains public source exported from [mikeminer/devfridge](https://github.com/mikeminer/devfridge/tree/10ec57e6076c7f132757b76e3d9c4570733efc83), commit `10ec57e6076c7f132757b76e3d9c4570733efc83`. Application source is unchanged. Export adaptations: two JavaScript test dependency paths now resolve this Android package rather than an adjacent `cold-storage` project; `esbuild` and a lockfile are included; this README and asset-fetch script are added. It excludes unrelated monorepo projects and large game media so the source can be audited. It is an evidence snapshot, not a replacement development history. Original development history: [PR 113](https://github.com/mikeminer/devfridge/pull/113).

## Build the Android app

Requirements: Node.js 22+, JDK 17, Android SDK platform 36 and build tools 36.0.0. Set `ANDROID_HOME` or create `android/local.properties` with your SDK path. Android 9+ is required to install.

```powershell
node scripts/fetch-game-assets.mjs
Set-Location android
npm ci --no-audit --no-fund
npm run prepare:game
npm test
.\gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

The download script fetches the original game distribution from the pinned public commit and checks every file against the SHA-256 hashes in `android/game-provenance.json`. It fails on a mismatch. No TLS exception is used. Generated assets, build outputs, local SDK configuration, signing keys and credentials are excluded from Git. Output: `android/app/build/outputs/apk/debug/app-debug.apk`, a debug APK for testing.

## Source map

| Behavior | Source |
| --- | --- |
| Android WebView, MWA authorize/signMessage, native share chooser, lifecycle and haptics | `android/app/src/main/java/cool/devfridge/world/MainActivity.kt` |
| Trusted origin and bridge limits | `android/app/src/main/java/cool/devfridge/world/BridgePolicy.kt` |
| SKR mint and positive raw token-balance check | `android/app/src/main/java/cool/devfridge/world/SkrBalance.kt` |
| Wallet bridge, controls and cosmetic state | `android/mobile/native-bridge.js` |
| Local adaptive advice | `android/mobile/adaptive-coach.js` |
| Saved-run and registration handoff | `android/mobile/registration-handoff.js`, `android/mobile/native-signing.ts` |
| Android input and safe-area styles | `android/mobile/android.css` |
| Build provenance and age-gate adaptation | `android/scripts/prepare-game.mjs`, `android/scripts/patch-gate.mjs` |
| Original game source | `world-game-v2/src/` |
| Existing server compliance and TopShelf entry points | `scan/app/api/world/`, `scan/lib/topshelf/` |
| Tests | `android/tests/`, `android/app/src/test/`, `android/app/src/androidTest/` |

The server files are reference excerpts and depend on the original monorepo. They are not a standalone server deployment. Android uses the existing production service. The separate optional Robinhood/EVM registration-page build also depends on the original `cold-storage` source; it is not required for Android debug assembly. Its three generated-bundle tests are skipped unless `REGISTRATION_BUNDLE` is supplied. See `android/README.md` and `android/MOBILE-REGISTRATION.md`.

## User and mobile rationale

The app is for casual Solana community players who want short physics rounds on Android. Browser play adds small touch targets, wallet switching and friction when saving or sharing a completed run. The Android layer keeps the game familiar while adding native feedback, sharing and wallet selection. Character access remains subject to the existing token-timelock eligibility checks.

SKR is optional: after disclosure and MWA authorization, the app checks the selected account's balance for the official mint on Solana mainnet. A positive balance enables the Aurora cosmetic for that session. No transaction is sent, and access, scores and prizes are unaffected. The RPC can observe the public wallet address and IP. Local advice learns from optional ratings; it is lightweight adaptive personalization, not a generative AI service.

## Evidence and limits

On 2026-10-03 this focused export passed Android debug assembly, unit tests and lint. Its JavaScript suite passed 23 tests with three generated-registration-bundle tests skipped. All 81 packaged upstream asset hashes were checked. These are build and test results, not live gameplay or wallet evidence.

On 2026-10-02 the original development build passed debug assembly, Android unit tests, lint and five Android 15/API 35 instrumentation tests. These tests cover renderer/bridge behavior and recovery paths; they do not establish a live wallet signature or completed production run.

The observed emulator launch reached the age gate but could not validate the production compliance endpoint's TLS chain on this PC. Live gameplay, MWA signing, SKR results, score sharing and restart persistence still need a working Android recording. The existing YouTube video is an earlier desktop/web walkthrough. No physical Seed Vault test is claimed. The practice preview at https://world.devfridge.cool/demo is separate from Android evidence.

App page: https://world.devfridge.cool/android

Existing signed beta: https://github.com/mikeminer/devfridge/releases/download/android-v0.3.1-beta.1/DevFridge-World-0.3.1-beta.1.apk
