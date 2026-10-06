# Android evidence — 6 October 2026

DevFridge World is for Solana community players who want a short, playable game on their phone with familiar wallet access and a clear way to keep and share their progress. The Android work addresses small browser controls, interrupted wallet handoffs and lost context around completed runs. Local practice lets a player learn the physics game before choosing live token-timelock access. Native wallet selection, lifecycle handling, sharing and local session history support that mobile loop.

This report describes version `0.3.2-beta.1` (`versionCode 8`) and records source, automated tests and observed emulator behavior separately. The beta APK release and unlisted YouTube recording are published. Earlier dated reports and the original Clock In audit are preserved.

The current downloadable beta is `0.3.2-beta.2` (`versionCode 9`), a release-manifest hardening follow-up. The original recording remains beta.1 evidence. Beta.2 removes three unused transitive test activities while preserving the exact compiled classes and game assets; it adds no new live-wallet or physical-device observation. [The dated source triage](SECURITY-TRIAGE-2026-10-06.md) records all 17 unconfirmed findings and the packaging comparison.

**Dated network follow-up:** at `2026-10-06T15:26:02Z`, after guest Wi-Fi repair, the installed beta.1 debug app completed a real native mainnet SKR request with zero parsed token accounts, filtered raw balance `0` and eligibility `false`. The [separate network report](evidence/2026-10-06/EMULATOR-NETWORK-FIX.md) preserves its scope and reproduction. The video's earlier failure is unchanged; this later instrumentation result is not a new wallet/UI run, positive SKR result or signed beta.2 execution.

## Artifact receipts

| Artifact | Receipt |
| --- | --- |
| Public Android source | [mikeminer/devfridge-world-android](https://github.com/mikeminer/devfridge-world-android) |
| Implementation commit used for this candidate | [a3226bb1349bbdbf1638426e3542f17affd9a7f1](https://github.com/mikeminer/devfridge-world-android/commit/a3226bb1349bbdbf1638426e3542f17affd9a7f1); final documentation/release commit recorded separately |
| Current beta APK release | [android-v0.3.2-beta.2](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.2) — publisher signed; [download](https://github.com/mikeminer/devfridge-world-android/releases/download/android-v0.3.2-beta.2/DevFridge-World-0.3.2-beta.2.apk) returned HTTPS 200; 65,775,562 bytes; SHA-256 `d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774` |
| Current release source and packaging evidence | [f2408f43af4446bcd082c93574f14c6f24eb3af6](https://github.com/mikeminer/devfridge-world-android/commit/f2408f43af4446bcd082c93574f14c6f24eb3af6); [manifest comparison](evidence/2026-10-06/audit/release-manifest-hardening.json), [signed release receipt](evidence/2026-10-06/beta2-release.json), release lint 0 errors and 11 JVM tests passed |
| Original recorded beta APK release | [android-v0.3.2-beta.1](https://github.com/mikeminer/devfridge-world-android/releases/tag/android-v0.3.2-beta.1) — original runtime/demo version; download returned HTTP 200 on 6 October 2026 |
| Original runtime source and evidence snapshot | [de54d8736838827de79d7cef0e3fc4931bbf5839](https://github.com/mikeminer/devfridge-world-android/commit/de54d8736838827de79d7cef0e3fc4931bbf5839) |
| Original publisher-signed APK | `DevFridge-World-0.3.2-beta.1.apk`; SHA-256 `7c8bfc6417c94596b11f1431741e7ff7b2eaf89236bd497a1f2228dc76c23b84`; [original APK download](https://github.com/mikeminer/devfridge-world-android/releases/download/android-v0.3.2-beta.1/DevFridge-World-0.3.2-beta.1.apk), HTTP 200 verified |
| Final combined Android recording | [Published unlisted YouTube video](https://youtube.com/shorts/LRDAhJhFfLI?feature=share), video ID `LRDAhJhFfLI`, displayed duration 2:49. Original uploaded MP4: 168.700 s, 540 × 1360, 30 fps, silent, 3,161,301 bytes; SHA-256 `3b02733967e6d33351f37eae35265220e2de971222f86747095655f3deadd9ad`. The hash identifies the local upload source, not YouTube-transcoded playback bytes |
| Descriptive captions and readable transcript | [15 SRT cues](evidence/2026-10-06/android-demo.en.srt), SHA-256 `2393ea77bf2848231646afca83c3e2c955d34b126d8dc32011285e94b19324df`; [transcript and source cut list](evidence/2026-10-06/android-demo.transcript.md), SHA-256 `13e1d778a3af42421dc1d2f7f52915503de76575729078716c99c4a3cf39551c`; [edit receipt](evidence/2026-10-06/android-demo-edit-receipt.json) |
| Public MWA evidence and independent verification | [Diagnostic JSON](evidence/2026-10-06/manual-mwa-evidence.json), [Ed25519 verification](evidence/2026-10-06/manual-mwa-verification.json) |
| Subsequent live native SKR network/parser result | [Native JSON](evidence/2026-10-06/native-skr-network-evidence.json), [separate connectivity receipt](evidence/2026-10-06/emulator-network-fixed-connectivity.json), [OK (1 test) output](evidence/2026-10-06/emulator-native-network-test.txt) and [dated report/reproduction](evidence/2026-10-06/EMULATOR-NETWORK-FIX.md), preserved at [b4a80ef](https://github.com/mikeminer/devfridge-world-android/tree/b4a80efc7c8ffb9e30e27e0f900e580ca4002e62/evidence/2026-10-06); installed beta.1 debug/code 8, API 35, passed `2026-10-06T15:26:02Z` |
| Completed native share receipt and actual delivered image | [Receipt JSON](evidence/2026-10-06/share-receipt.json), [received 20-point PNG](evidence/2026-10-06/share-receipt.png) |
| Final emulator runtime screenshots | [Touch score 20](evidence/2026-10-06/practice-touch.png), [completed local round](evidence/2026-10-06/practice-complete.png), [actual receiving activity](evidence/2026-10-06/share-final20.png), [history after force-stop/reopen](evidence/2026-10-06/history-final.png) |
| Original beta.1 website publication | [world.devfridge.cool/demo](https://world.devfridge.cool/demo), [/android](https://world.devfridge.cool/android) and [/android/it](https://world.devfridge.cool/android/it) returned HTTPS 200 at `2026-10-06T11:27:35.9548075Z`; YouTube embed/transcript and the original beta.1 APK URL/version/hash checked; [historical publication receipt](evidence/2026-10-06/website-publication.json) |
| Current beta.2 website and local-practice onboarding | At `2026-10-06T12:48:20.706Z`, all 40 public country pages in 29 languages returned HTTPS 200 with the exact localized practice/Live installation step and unchanged beta.2 metadata and Store badge. `/demo` retains the beta.1 recording and readable transcript; release JSON retains beta.2/code 9, the signed hash and existing certificate. Website source `1b11205150a5a77a51739db4082618f1b8aa51b3`, deployment `dpl_3Mc7K12KC8ZEwsHYUf7HT7JzreKg` READY; [current publication receipt](evidence/2026-10-06/website-beta2-onboarding-publication.json) |
| Final JavaScript, JVM and lint | 38 JavaScript tests passed, three generated-registration skips; 11 JVM tests passed; debug lint zero errors |

The recorded beta.1 release is pinned to source/evidence commit `de54d8736838827de79d7cef0e3fc4931bbf5839`; current beta.2 is pinned to `f2408f43af4446bcd082c93574f14c6f24eb3af6`. Default Gradle release assembly is unsigned; both separately published publisher-signed APKs retain the existing release certificate and exclude the local emulator CA.

The 2:48.700 combined recording retains actual source pixels without cropping and every visible action at its original speed. Descriptive labels sit outside the Android frame. Idle waits and repeated no-op taps were trimmed; a separate card marks the later successful sharing retry. The wallet diagnostic is explicitly a separate segment. Source hashes, cut times and output timing are in the public edit receipt. A [separate media check](evidence/2026-10-06/android-demo-media-qa.json) records a complete FFmpeg decode of 5,061 frames, matching hashes, 15 nonoverlapping SRT cues and representative visual review. It is media verification, not an application security audit. The original practice and wallet recordings remain preserved locally; their hashes and exact cut ranges are published in the edit receipt. Raw MP4 downloads are not published. The final presentation is available on YouTube; captions, transcript, screenshots and machine-readable receipts are in this repository.

## Implemented mobile features

The APK bundles the hash-pinned live Three.js/Rapier distribution with Android-specific gate/network error handling, wallet bridge and touch styles. Kotlin supplies MWA authorization and exact-message signing, haptics preferences, native image/text sharing, lifecycle pause and the menu. Live character access continues to require the existing eligible Solana timelock. Practice does not grant live eligibility.

The new native practice route is the exact first-party game document with `?mode=practice`. It uses the actual pinned demo renderer and physics engine, with counted adapters for a 60-second active-play timer, local completion, isolated engine storage and practice-labelled sharing. The source and adapters are recorded in `android/practice-source.json` and `android/practice-provenance.json`. Hash or patch-boundary mismatches fail preparation. The practice page cannot issue ranked start/finish or fee requests, and the native bridge blocks its wallet/signing/registration requests. Its results are local, without a ranking or prize claim.

Recent sessions are available from the native menu before a game starts and from game/result screens. At most 20 completed score/time/mode records remain on the device. A personal replay goal compares sessions in the same mode; a fresh install shows an empty state. Records can be cleared and unavailable storage is visible. The on-device coach selects localized tips and adjusts selection using voluntary helpfulness ratings. These are implemented local progression features, not evidence of measured retention, active users or a community challenge campaign. No generative-model API is claimed.

## Observed Android execution

| Flow | Established observation | Remaining boundary |
| --- | --- | --- |
| Actual 3D practice and touch input | Android 15/API 35 emulator displayed the actual renderer; touch fusion showed “MERGED Aperitivo” and score 20; the result read “Practice complete” with 20 points | The published recording demonstrates local practice, not live token-timelock eligibility or ranked play |
| MWA connection | Official Solana Mobile SDK Fake Wallet authorized an unfunded test account through the app's wallet-standard/native bridge | This diagnostic does not establish Phantom or physical Seed Vault execution |
| Exact-message signing | Wallet returned a 64-byte signature for the diagnostic message; independent Ed25519 verification returned true | Not a live timelock authorization, server-verified score authorization or payment |
| Recorded morning SKR consent/check | Real disclosure and consent were followed by a live RPC attempt; the app displayed “SKR check unavailable” with Retry/Close | DNS prevented a balance result in this unchanged historical recording |
| Subsequent native SKR network/parser check | On 6 October at 15:26 UTC, an opt-in instrumentation test invoked unchanged `readSkrAccounts` against installed beta.1 debug/code 8 after Wi-Fi repair: parsed accounts `0`, filtered raw SKR `0`, eligibility `false`; no mocked response | No new wallet/UI flow, positive SKR/Aurora result or signed beta.2 run; raw RPC array count, HTTP status and slot are not independently recorded |
| Session history | After `am force-stop` and reopening the actual APK, local best remained 20 and Recent sessions displayed completed 20-point records, including the final 10:35 session; source tests additionally cover bounds and storage failures | This is local device persistence, not a server-verified or on-chain result |
| Native score-image sharing | Android delivered the actual 20-point practice PNG to a local receiving activity with `ACTION_SEND` and temporary read permission; it read and accepted the 1080 × 1350 image | The receiver is an instrumentation test target; no external social-network posting is claimed |
| Haptics and lifecycle | Native preferences, pause/recovery paths and touch hooks are implemented | Emulator behavior does not establish physical haptic sensation or every interruption case |
| Live eligible-game round and TopShelf | Existing compliance, timelock and saved verified-run integration remain intact | No eligible live Android round, paid entry or prize claim was completed in this test |

The practice result/layout and texture defects found during real play were corrected, and the subsequent result and reopened-history captures show the actual 20-point local result. The linked runtime screenshots above preserve the actual captures. The combined recording also shows Home/return pause, Resume and on-device adaptive advice on the completed result. No completed result from a unit-test fixture is presented as real gameplay.

The [share receipt](evidence/2026-10-06/share-receipt.json) records `android.intent.action.SEND`, MIME type `image/png`, a content URI from `cool.devfridge.world.files`, both read permission and its explicit grant flag, and `accepted: true`. The received PNG is 1080 × 1350 pixels and 272,027 bytes, SHA-256 `2bb53e2ff7b92414f1f63adde37031e09effda0026223be7b7bd73d153900594`. Its caption states 20 points in local practice with no ranking or prizes. `testTarget: true` and `sentExternally: false` describe the destination honestly.

## Actual MWA diagnostic

The opt-in `ManualMwaEvidenceTest` is part of the instrumentation APK rather than the shipped application interface. It used the official SDK Fake Wallet with unfunded test keys. Visible controls identify the test as “Not game access, a ranked score or a payment.” The normal authorization/signing actions were used; the wallet's simulated-error controls were not used.

The recorded diagnostic began at `2026-10-06T08:57:49.555Z`. It recorded account connection at `08:58:42.885Z`, a 64-byte message signature at `08:59:11.005Z`, and the SKR unavailable dialog at `08:59:45.046Z`. These are UTC timestamps; the run took place on 6 October in the publisher's Europe/Rome timezone.

The message contains the DevFridge World domain, selected account, a fresh nonce, issue time and the purpose of checking message signing. It explicitly excludes game access, ranked score registration and a financial transaction. Evidence records `productionAuthorization: false` and `financialTransactionRequested: false`. No private key is exported.

The independent `android/scripts/verify-mwa-evidence.mjs` verification result is:

| Property | Result |
| --- | --- |
| Algorithm | Ed25519 |
| Signature valid | `true` |
| Public key size | 32 bytes |
| Signature size | 64 bytes |
| Evidence SHA-256 | `0afc0e895a7e6f83337787b0eac44a1e1ce23ff0758e5957ccbbdfa51c47286d` |
| Message SHA-256 | `1418cce401ebe901b761e363ddc6b186328c263fe72dea755861f3009b30fdc7` |

The manual instrumentation run completed with `OK (1 test)`. Its real signature is narrower evidence than a production eligibility or score flow. The wallet recording visibly includes the debug app identity warning; that warning has not been edited out or described as release identity verification.

## SKR, identity and network behavior

The morning SKR attempt shown in the video used the app's native consent and read-only mainnet query. At `08:59:45.046Z`, emulator DNS could not resolve the RPC host, so the app offered Retry/Close and stated that access and scores were unchanged. That failure was not treated as zero SKR, successful verification or entitlement to Aurora; the recording establishes no balance result. Its video and JSON receipt are preserved unchanged.

At `15:26:02Z` on the same date, a separate opt-in `EmulatorNetworkEvidenceTest` passed against the already-installed debug beta.1/code 8. Guest Wi-Fi had been disabled; enabling it restored a validated default network, and connection and DNS resolution persisted across a restart. Only the instrumentation APK was installed for this follow-up. The test invoked the unchanged native `MainActivity.readSkrAccounts` off the UI thread for public account `CQDmky2kNKNae5yjDxhrD5eu3mKvYui4AcqZxzr1B5oQ`, the account in the earlier SDK diagnostic. Its actual mainnet `getTokenAccountsByOwner` request returned normally: parsed records `0`, filtered raw SKR `0`, eligibility `false`, no mocked response or financial transaction. [The report](evidence/2026-10-06/EMULATOR-NETWORK-FIX.md) links native and connectivity receipts and reproduction commands; these records are pinned at [b4a80ef](https://github.com/mikeminer/devfridge-world-android/tree/b4a80efc7c8ffb9e30e27e0f900e580ca4002e62/evidence/2026-10-06).

The native function rejects HTTP/JSON-RPC errors but skips malformed individual account records. It does not export raw `result.value` count, HTTP status or slot; zero parsed records therefore do not independently establish an empty raw RPC array. This result proves native network/parser success on the installed debug app. It does not demonstrate a new wallet authorization/signature, visible SKR consent/result dialog, gameplay, positive SKR/Aurora, physical-device behavior or signed beta.2 execution. The diagnostic retained certificate validation, but it did not audit the debug trust-store/build flags or establish release TLS behavior. No production network code or release APK was changed for this repair.

At `2026-10-06T08:40:25.8807896Z`, `https://world.devfridge.cool/.well-known/assetlinks.json` returned HTTP 200, JSON content and no redirect for package `cool.devfridge.world`. It included release signing certificate SHA-256:

`2A:CA:BF:ED:1A:E8:87:ED:90:E6:50:A4:44:6E:5E:F7:47:DE:09:6F:0F:D6:EA:75:A8:94:8B:75:B0:60:71:CA`

The corresponding website commit was `2f5c56a8c17718791412393520451acca5f0bc05`; deployment `dpl_3jQiMW2pteNMVKvsNJs8wNVqcb79` was READY. This checks the published release association; it does not establish that the debug APK or a physical wallet completed release identity verification.

This PC uses HTTPS interception. An explicit local-debug build may include the existing Windows-trusted public root after normal chain validation. Local resources are ignored and excluded from default debug and release resources. The recording is emulator/debug evidence, with that configuration disclosed; TLS verification is not disabled.

## Automated checks and dependency remediation

The recorded beta.1 candidate passed 11 Android JVM unit tests, debug lint with zero errors, debug assembly and release assembly. The JavaScript integration/safety suite passed 38 tests, with three generated registration-page tests skipped because the separate bundle is absent. The recent-session/coach targeted suite passed 11 tests, including restart restoration at DOM-test level, the native history hook, malformed storage, practice/local separation and visible storage failures. The separately observed emulator force-stop/reopen result supplies actual APK persistence evidence beyond those fixtures. For beta.2, all 11 JVM tests, release lint with zero errors and release assembly passed again; the manifest-only follow-up was not presented as a new debug or emulator run.

The original [Clock In audit](CLOCK-IN-AUDIT-7ff05bc.md) applies to commit `7ff05bc1780bf2a92514585ae67123c5f3270f88`, with 18 findings and incomplete coverage. Later changes did not replace that report or perform a new independent program audit.

Dependency remediation through `8f03b16` updated sharp, Vite and source-map-js, and removed the vulnerable glTF CLI/glob-parser chain by using the official optimizer APIs. The dated [registry audit JSON](evidence/dependency-audit-2026-10-06.json) contains zero known vulnerabilities in the reference web-tool dependency tree. Six real model optimization outputs from three pinned characters decoded successfully and matched the previous CLI outputs byte for byte, including SHA-256. [Dependency evidence](DEPENDENCY-EVIDENCE-2026-10-06.md) records the exact versions and reproduction checks; [security follow-up](SECURITY-REVIEW.md) retains the remaining source-review limits.

Registry advisory status, source review, unit fixtures, cryptographic verification and emulator execution are different evidence. The report does not establish complete application safety, physical-device behavior, a live ranked game, paid registration, positive SKR holdings or measured retention.

## Reproduction entry points

The [root README](README.md) and [Android README](android/README.md) contain the hash-checked asset fetch, build, test and manual MWA diagnostic commands. The published YouTube recording, repository captions/transcript and beta APK release are identified above. Local original-video hashes and raw-source preservation remain separate from YouTube playback and the published APK download.
