# Targeted checks of published Android beta.2 — 7 October 2026

The published `0.3.2-beta.2` / code 9 APK was inspected directly, and its packaged native/registration/gate JavaScript was exercised with hostile synthetic inputs. The checks add evidence for the reported trust boundaries without changing the game, contract, wallet implementation or published APK. They are developer verification, not an independent security audit or Solana program analysis.

## Exact artifact and code boundary

APK SHA-256: `d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774`, 65,775,562 bytes. Release source: [f2408f43af4446bcd082c93574f14c6f24eb3af6](https://github.com/mikeminer/devfridge-world-android/commit/f2408f43af4446bcd082c93574f14c6f24eb3af6). The inspector refuses an APK with a different hash from the [publisher release receipt](evidence/2026-10-06/beta2-release.json).

[Signed-APK inspection](evidence/2026-10-07/audit/signed-beta2-boundaries.json) records 24 passed checks, compiled resource IDs/files, asset hashes and the unchanged policy-source fingerprint. Tested generated adapter files were byte-equal to their signed-APK ZIP entries. `classes.dex` retains SHA-256 `85f1d0aaad391cb9c0131cf15a8ff8620d9f4207d131197ab3326c2757907a92`; the JVM policy source was compared with the release tag. The [hostile-input JavaScript suite](android/tests/security-boundaries.test.mjs) checks the APK-bound hashes before evaluating the actual packaged adapter bytes.

## Recorded results

| Check | Result and evidence |
| --- | --- |
| New packaged-adapter hostile-input suite | **11 passed**, zero failures/skips; [actual output](evidence/2026-10-07/audit/node-security-boundaries.txt) |
| Full JavaScript suite | **49 passed**, zero failures; three separate generated registration-page tests skipped because that bundle is absent; [output](evidence/2026-10-07/audit/node-full-suite.txt), [summary](evidence/2026-10-07/audit/javascript-tests.json) |
| Release JVM tests | **15 passed**, zero failures/errors; includes four new [hostile URI/policy tests](android/app/src/test/java/cool/devfridge/world/BridgePolicyAdversarialTest.kt); [summary and hashed original XML reports](evidence/2026-10-07/audit/release-jvm-tests.json) |
| Exact signed release packaging | **24 passed** static checks; [inspector](evidence/2026-10-07/audit/inspect-release.py), [compiled manifest](evidence/2026-10-07/audit/signed-beta2-manifest.txt), [FileProvider resource](evidence/2026-10-07/audit/signed-beta2-file_paths.txt), [network resource](evidence/2026-10-07/audit/signed-beta2-network_security_config.txt) |

Initial restricted-shell launches were blocked by Gradle's outside-workspace cache lock and the existing esbuild helper's `spawn EPERM`. The authorized local cache/helper execution allowed the recorded final suites to complete; those launch failures were not application assertion failures. No new APK assembly or installation was needed for these tests.

## What the adversarial cases establish

The actual packaged score/registration adapter renders hostile stored metadata, server error strings and exact authorization messages as text, without creating injected image/SVG/script/iframe/object/embed nodes. Opening a saved-score panel or receiving a return does not automatically sign or open a wallet. Malformed stored run IDs and unsolicited returns cause no signature or registration request.

Request/run/wallet/score/season/expiry/message mutations are rejected before signing. A message changed between display and approval is rejected before signature or delivery. The native adapter ignores malformed, unknown and replayed reply IDs, registers no wallet in an iframe or lookalike/non-HTTPS origin, and rejects oversized/non-PNG/multiple-file shares before native invocation. The packaged compliance gate displays an injected server refusal as text and keeps the game hidden.

JVM cases exercise the unchanged release `BridgePolicy` with scheme/authority confusion, userinfo, alternate ports, traversal/encoded paths, invalid escapes, injection-bearing IDs, duplicate fields and wrong return authorities. Stale generations and foreign documents cannot receive an earlier wallet result. Ambiguous practice queries do not select the practice document; native asset interception uses that same exact predicate. These are in-process policy tests, not Android intent penetration testing.

## Relationship to the 17 original audit leads

| Original category | Current evidence and remaining boundary |
| --- | --- |
| Five reference-source HTML assignments | [Original source traces](SECURITY-TRIAGE-2026-10-06.md#review-of-all-17-reported-locations) identify first-party cast fields or numeric engine values. New malicious-input tests cover the actually packaged gate/registration display boundaries. They do **not** execute every HTML sink in the two complete 3D engine distributions or replace the original trusted-metadata assessment. No arbitrary cast-document injection path was established. |
| Exported share-receipt test activity | Absent from the inspected signed release manifest. It belongs to the separately installed instrumentation APK, which is not the player release. |
| Five instrumentation external-file writes | Their source boundary remains instrumentation-only. Actual release sharing exposes only a `cache-path` named `shares` with path `shares/`, through a non-exported FileProvider with scoped URI grants. This static resource check does not simulate every receiving app or Android storage version. |
| Exported launcher/registration activity | The signed manifest has exactly one activity, `MainActivity`, exported for launch/return. Hostile-return/origin tests now supplement the existing policy tests. Three transitive instrumentation activities are absent. `ProfileInstallReceiver` remains exported with `android.permission.DUMP`; not all components are non-exported. |
| HTTP string/endpoint lead | `http://www.w3.org/2000/svg` is the fixed wallet icon's namespace, not a fetched endpoint. The compiled release prohibits default cleartext and allows only non-subdomain `localhost` / `127.0.0.1` exceptions. Its network XML contains no custom trust anchors or debug overrides. This is policy inspection, not a TLS handshake or wallet identity result. |
| Four web3.js v1 maintenance leads | Coordinated migration of the complete server remains a maintenance boundary; no excerpt-only migration or new vulnerability/program-audit conclusion is claimed. |

The [original audited report](CLOCK-IN-AUDIT-de54d87.md) and its SHA-256 `2902aebe8d9c9771394a3649ae0c64bdd8b650fac13085df6b4fa1dfeae3779f` remain unchanged. It concerns audited commit `de54d8736838827de79d7cef0e3fc4931bbf5839`. The tests found no confirmed defect in the exercised boundaries; this does not establish absence of defects elsewhere.

## Reproduction

After the repository's normal hash-checked game asset preparation, download the exact published beta.2 APK to a local path. Python 3 and Android SDK `aapt2` inspect it without installation:

```powershell
python evidence/2026-10-07/audit/inspect-release.py --apk <beta2-apk-path> --aapt2 <sdk-aapt2-path> --out evidence/2026-10-07/audit
Set-Location android
node --test --test-isolation=none tests/security-boundaries.test.mjs
node --test --test-isolation=none tests/*.test.mjs
.\gradlew.bat --offline :app:testReleaseUnitTest
```

The `--test-isolation=none` flag avoids Node test-file child-process isolation on the recorded Windows environment; the existing native-signing tests still require the local esbuild helper to run. Gradle requires a writable cache and configured Android SDK/JDK 17. XML receipts and their hashes preserve the actual JVM execution.

No device/emulator, live funded wallet, positive SKR, physical Seed Vault, ranked run or release TLS execution is added by this work. Those remain the separate [Android evidence](ANDROID-EVIDENCE-2026-10-06.md) scopes.
