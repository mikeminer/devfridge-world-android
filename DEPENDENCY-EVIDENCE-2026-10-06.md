# Dependency remediation evidence — 6 October 2026

The Clock In report applies to the original source export commit [`7ff05bc1780bf2a92514585ae67123c5f3270f88`](https://github.com/mikeminer/devfridge-world-android/tree/7ff05bc1780bf2a92514585ae67123c5f3270f88). Its [unchanged original report](CLOCK-IN-AUDIT-7ff05bc.md) lists development-tool findings for sharp 0.33.5, Vite 5.4.21 and Vite's esbuild 0.21.5 dependency. The following source changes occurred after that report; the report itself was not replaced.

| Finding or dependency | Current result | Change evidence |
| --- | --- | --- |
| sharp 0.33.5, two high advisories | sharp 0.35.5 | [Upgrade commit e984bca](https://github.com/mikeminer/devfridge-world-android/commit/e984bca0c663d45cd34a6a9238dda1130f564ac2) |
| Vite 5.4.21, three advisories | Vite 8.3.2 | Same upgrade commit |
| esbuild 0.21.5 via old Vite | Absent from this web-tool lockfile | Vite 8 uses Rolldown |
| source-map-js 1.2.1, high advisory | Compatible update to patched 1.2.2 | [Official advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), current lockfile |
| glTF Transform CLI → micromatch → braces, high advisory | CLI and its glob-parser chain removed | Optimizer scripts now use official glTF Transform APIs |

The braces advisory has [no patched release](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) at the time of this check. The migration removes the dependency and preserves model optimization, rather than suppressing the advisory or applying npm's suggested breaking CLI downgrade. The API modules are pinned at 4.5.1, Draco at 1.5.7, Meshoptimizer at 1.2.0 and keyframe-resample at 0.1.0. The scripts use local file paths; an HTTP fetch or glob parser is not registered.

## Recorded checks

A fresh `npm ci --no-audit --no-fund` completed successfully with normal package installation scripts enabled. The subsequent [registry audit JSON](evidence/dependency-audit-2026-10-06.json) reports zero known vulnerabilities in `world-game-v2`'s current dependency tree. The lockfile SHA-256 is `a78ab20525cd65c9e276727f52a87269ef42521ea2c843d62c3d75cb8fd81008`. Node 24.18.0 and npm 11.16.0 were used on Windows x64. The audited registry data is a dated snapshot; future advisories can change its result.

The optimizer compatibility check used three actual character assets restored by the repository's pinned asset fetcher: Rugarugo, GmGnocco and Moonzarella. Both Draco with WebP textures and Meshopt with original texture formats were checked. All six API outputs were decoded successfully and matched the installed official CLI 4.5.1 output byte for byte, including output SHA-256, mesh/primitive/vertex counts, materials, textures, skins, animations and extensions. The [baseline JSON](evidence/optimizer-cli-4.5.1-baseline.json) includes each pinned input hash and output hash.

| Actual asset | Meshopt output | Draco/WebP output |
| --- | ---: | ---: |
| Rugarugo | 2,093,508 bytes | 300,492 bytes |
| GmGnocco | 1,334,924 bytes | 228,612 bytes |
| Moonzarella | 1,798,976 bytes | 252,244 bytes |

The reference Vite production build passed into a separate `build-world-source` directory. It retains warnings about a classic external SDK script and large Three.js/physics chunks. The pinned Android game distribution and original model files were not overwritten by these checks. Whole-pipeline portrait/audio preparation from the original v1 asset set was not executed; the focused export's pinned v2 assets support the recorded model compatibility test.

## Reproduction

After cloning this repository:

```sh
node scripts/fetch-game-assets.mjs
cd world-game-v2
npm ci --no-audit --no-fund
npm audit --json
npm run verify:optimizer
npm run build -- --outDir ../build-world-source
```

`verify:optimizer` generates temporary outputs and compares them with the preserved CLI baseline; the removed CLI is not needed. Its inputs must match the pinned baseline. Byte equality was verified on Windows x64 with the recorded versions. An output difference on another platform needs investigation rather than regenerating the baseline to make a failing test pass.

These results cover registry dependency advisories, reference compilation and the two optimizer modes on the named assets. They do not establish complete source security, a Solana program audit, APK runtime correctness, wallet signing, SKR success, physical-device behavior or a new independent portal audit.
