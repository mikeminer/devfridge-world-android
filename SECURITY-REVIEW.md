# Clock In audit follow-up — updated 6 October 2026

The portal audit analyzed commit `7ff05bc1780bf2a92514585ae67123c5f3270f88`. It reported 18 findings (7 high, 7 medium, 4 low), did not complete every check and assigned no security score. It is an advisory source review, not a completed independent audit. Later source changes do not erase that report or imply another portal audit was performed.

The original downloaded [Clock In report](CLOCK-IN-AUDIT-7ff05bc.md) is preserved verbatim. It states that 112 files were read. The portal's status remains authoritative about its incomplete checks; the report is not a clearance certificate. On 3 October the AI Coach showed `CODE NONE` despite the portal's audit panel showing this report. The 6 October Coach result supplied by the publisher now shows `CODE READ`; the original audit's partial coverage is unchanged.

## Dependency remediation after that snapshot

The reference web game's development tools were upgraded to Vite 8.3.2, sharp 0.35.5 and glTF Transform CLI 4.5.1. `npm audit fix` updated the compatible brace-expansion dependency. The reference game's Vite production compilation passed using a separate output directory. The existing Android game distribution remains pinned to its original asset hashes; it was not silently replaced by this reference-source rebuild.

The old Vite 5/sharp 0.33/esbuild 0.21 findings no longer apply to the updated tool lockfile. Those upgrades were committed at [`e984bca0c663d45cd34a6a9238dda1130f564ac2`](https://github.com/mikeminer/devfridge-world-android/commit/e984bca0c663d45cd34a6a9238dda1130f564ac2), after the audited snapshot.

On 6 October, a compatible lockfile update also moved `source-map-js` to its patched 1.2.2 release. The remaining glTF Transform CLI → micromatch → braces chain was removed by migrating the two local model-optimization scripts to the official glTF Transform API. The replacement retains the same Draco/WebP and Meshopt optimization defaults, with explicit local-file I/O. Six outputs from three real pinned character assets were decoded and matched the prior CLI 4.5.1 output byte for byte, including SHA-256. No breaking CLI downgrade or vulnerability suppression was used.

The fresh web-tool `npm audit --json` reported zero known vulnerabilities on 6 October after a clean lockfile install. [Dependency evidence](DEPENDENCY-EVIDENCE-2026-10-06.md) preserves the report, version mapping, commands and compatibility checks. This is registry advisory evidence for one package tree, not an independent audit, a program analysis or proof of complete application security. The original portal report remains available unchanged.

## Low-confidence findings needing source interpretation

The report's non-local HTTP finding points at `android/mobile/native-bridge.js`'s SVG namespace `http://www.w3.org/2000/svg`. That string is an XML namespace in a data URI, not a fetch endpoint. Production Android cleartext traffic is disabled in the manifest and network configuration.

The launcher activity is intentionally exported for Android launch and the registration return deep link. Removing export or adding an app-only permission would break those flows. A launch intent is not authorization: `BridgePolicy` and registration code check the first-party origin, return structure, stored run and original wallet before delivering a result. Runtime wallet return behavior still requires live validation.

The four external-storage findings refer to screenshot output in `android/app/src/androidTest/.../StoreScreenshotsTest.kt`. This instrumentation test writes emulator captures; it is not part of the release APK. Actual share output and its FileProvider scope should continue to be reviewed independently.

The five dynamic-HTML findings refer to the reference `world-game-v2/src/boot.js` and `game.js`. Some values are numeric or fixed local game messages; character metadata is inserted into HTML templates. The finding is retained: this snapshot does not prove that all metadata sources are safe, nor that each reference-source sink maps to the pinned APK bundle. Source hardening and shipped-bundle reachability review remain open. The web3.js v1 imports likewise remain documented rather than being declared cleared.

## Verification boundaries

The focused Android export passed debug assembly, lint, six Android unit tests and 23 JavaScript tests on 3 October. Three generated registration-page tests were skipped. These checks do not establish a live MWA signature, a successful SKR RPC response, production gameplay, sharing, restart persistence or absence of vulnerabilities.
