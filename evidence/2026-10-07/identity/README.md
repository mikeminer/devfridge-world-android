# Public Android identity evidence — 7 October 2026

[Production PR #116](https://github.com/mikeminer/devfridge/pull/116), commit `5bccf8fc97f8b1241e72eade3b8fc1a00f871135`, corrected the MIME type of `https://world.devfridge.cool/.well-known/assetlinks.json` to exactly `application/json`. The association itself remained unchanged. The public-production receipt below records HTTP 200 without redirects, the expected package and release certificate, and Google's Digital Asset Links response `linked: true` at 13:36:40–13:36:41 UTC. It verifies the public endpoint; deployment readiness and wallet-side retrieval were not independently established by that receipt.

## Release identity

- Package: `cool.devfridge.world`
- Release: `0.3.2-beta.2`, version code `9`
- APK SHA-256: `d60e046d0f4a314a2d954a8ebbfc079cdc21b54af2c6ce6fbdcf6f9e84913774`
- Signing certificate SHA-256: `2acabfed1ae887ed90e650a4446e5ef747de096f0fd6ea75a8948b75b06071ca`

The certificate fingerprint is public association data, not a private signing key. The APK hash identifies the existing signed release; this addition does not replace or rebuild it.

## Preserved receipts

Both files are byte-for-byte copies of the original diagnostic outputs, including their line endings.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| [mwa-identity-publication-fixed.json](mwa-identity-publication-fixed.json) | 3,736 | `82ee603fc2435adf01f450f0efce5c1a314352218a7d0fe467d3ad001e50b03e` |
| [android-after-route-fix.txt](android-after-route-fix.txt) | 626 | `65abf52b5778221101a53ed549641c39fd725540ea796966ffc53b18ec6ea04d` |

The JSON references the earlier failure receipt by hash; that earlier file is not part of this two-receipt addition. The text file records a normal Android shell probe using default certificate and hostname verification, without a trust override. TLS 1.3 connections succeeded for the site and the named Solana/Phantom endpoints. The Phantom endpoint returned HTTP 403, so this is transport evidence rather than successful Phantom API access. The separate DAL probe found the expected JSON MIME, package, release certificate and relation.

## Runtime observation and limits

After this production fix, the identity warning in a real Phantom consent screen cleared in local testing. This is a reported local observation; no screenshot is published because the screen exposed private balances. The public JSON and shell probe do not independently prove that UI observation.

Phantom authorization still timed out after 90 seconds. There is no successful authorization or message-signing result from this attempt, and no claim of eligible-wallet character access, a positive SKR balance, or a completed live round. The Android shell probe does not establish the APK's own TLS handshake, an MWA signature, or an end-to-end wallet flow.
