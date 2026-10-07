# Generated registration-page test follow-up — 7 October 2026

The three integration tests skipped in the earlier [security verification](../../../SECURITY-VERIFICATION-2026-10-07.md) were executed successfully after building the separate registration page with the existing script. The targeted run passed **3/3 tests**, and the full JavaScript suite passed **52/52 tests with zero failures and zero skips**, ending at `2026-10-07T12:36:54.845Z`.

The original report, 49-pass/three-skip summary and test logs retain their original bytes and timestamps. This is a subsequent result, not a replacement for that historical run. The signed beta.2 APK retains SHA-256 `d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774`.

## Build and inputs

The unchanged [build script](../../../android/scripts/build-registration-page.mjs) expects an original `cold-storage` sibling project. An isolated staging layout copied that script, the page bootstrap/HTML/native-signing source, and the two original client source files byte for byte. Its `node_modules` junction uses the already-installed original project's dependencies. No dependencies were installed, no network request was used by these tests, and no production page, engine, Android assets or APK was written.

Installed versions were Node `24.18.0`, esbuild `0.28.2`, ethers `6.15.0` and happy-dom `20.14.5`. The source files and original package/lock files are hash-recorded in the [successful run summary](run-summary-2026-10-07T12-36-40.162Z.json). The focused repository HEAD was `efc10a4cdc6e1e12cd533485d2bb854cc29d3c18`; the original workspace source directory has no valid Git HEAD. The raw `monorepoHead: "HEAD"` field in that summary is unsuccessful command output, **not a commit identifier**. Those original inputs are pinned by their recorded file hashes, not by a claimed immutable source commit.

The generated [JavaScript bundle](bundle/registration.js) is 272,351 bytes, SHA-256 `0f0b9ef35b6833a8e6f4de2960189e633fe9e0c9b8f9525b7065ebe451c5c66a`; its [build provenance](bundle/provenance.json) records the original registration and native-signing hashes. This newly generated external page has not been deployed and is not claimed to be a byte match for the page currently served in production or a packaged APK asset.

## Executed coverage

| Existing integration test | Exercised behavior | Limit |
|---|---|---|
| Built Phantom page retrieves the server draft and renders the real registration controls | Temporary capability sent as a bearer header; completed-run summary and fee/token controls render; payment stays hidden before separate EVM-wallet steps | Draft, fees and Phantom account are fixtures |
| Native signing path opens the existing payment UI without requiring a Phantom Solana account | Native entry opens the existing registration controls when the Phantom Solana object is absent; the page explains approval through the original wallet | This test does not perform MWA authorization or sign a message |
| Different Solana account and expired links cannot proceed to payment | Mismatching account and simulated HTTP 410 expiry block the payment path | No live server response or chain payment is established |

These are happy-dom/VM integration tests against the actual generated bundle, not Android execution, paid TopShelf registration, a positive SKR result, physical-device evidence, independent security clearance or exhaustive engine coverage. Fixture values are not user/adoption data.

## Receipts and reproduction

[Build output](build-2026-10-07T12-36-40.162Z.txt), [three-test output](targeted-tests-2026-10-07T12-36-40.162Z.txt) and [complete-suite output](full-tests-2026-10-07T12-36-40.162Z.txt) retain the actual execution logs; their hashes and exit codes are in the successful run summary. The first [sandbox launch failure](build-2026-10-07T12-35-30.123Z.txt) and [attempt summary](run-summary-2026-10-07T12-35-30.123Z.json) are preserved: Node child-process spawning returned `EPERM` before the build or test assertions ran. Allowing the existing local Node/esbuild helper processes enabled the subsequent successful run.

To run the same tests using the recorded generated bundle, from `android/` after installing the declared development dependencies:

```powershell
$env:REGISTRATION_BUNDLE = (Resolve-Path '..\evidence\2026-10-07\registration-followup\bundle\registration.js').Path
node --test --test-isolation=none tests/registration-page.test.mjs
node --test --test-isolation=none tests/*.test.mjs
```

To regenerate from the original client sources, [build-and-test.mjs](build-and-test.mjs) creates a new staging directory, invokes the unchanged original build script, runs the tests, and writes new timestamped logs. From the repository root:

```powershell
node evidence/2026-10-07/registration-followup/build-and-test.mjs 'C:\path\to\original-monorepo'
```

This command requires the original `cold-storage/src/score-registration.ts`, `score-protocol.ts`, package/lock files and installed esbuild/ethers dependencies. Rebuilding with other input or dependency versions may change the bundle hash; the recorded receipt identifies the inputs actually tested here. No production or existing test symbol was edited for this follow-up.
