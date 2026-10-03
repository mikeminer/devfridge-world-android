# Android emulator verification — 2026-10-03

Source: `e984bca`, Android 15 / API 35, x86_64, official Android Emulator, AVD DevFridgeDemo. This is a development test, not certification of the published release.

## Observed results

The debug APK installed successfully. The bundled app opened and displayed its wallet/timelock access screen. The native menu opened. Share game opened Android's native text share sheet. No message was sent to another person. Turning haptics off survived force-stop and reopening: the menu then offered Turn haptics on. This proves preference persistence, not physical vibration or score persistence.

The official Solana Mobile SDK Fake Wallet app received the MWA association, displayed DevFridge World and mainnet-beta, and returned an authorization result to the application. This is a demonstration wallet with test keys, not Phantom or Seed Vault. Its identity verification displayed Verification failed for this debug application; identity association is unresolved and must not be presented as verified.

The app then attempted its SKR read but displayed SKR check unavailable. Observed errors included local DNS resolution failure for api.mainnet.solana.com and an untrusted certificate chain. No successful SKR response or positive balance was demonstrated. No financial transaction was requested or made.

## Local environment changes

The PC intercepts HTTPS through an existing Windows-trusted antivirus certificate. Normal Windows TLS validation confirmed the live endpoint certificates and the same trusted root. Only the public root certificate was exported into ignored emulator resources. An explicit `-PlocalEmulatorTls=true` debug build uses this certificate for world.devfridge.cool and api.mainnet.solana.com; normal debug and release builds exclude these resources. Certificate verification was not disabled. The public APK was not replaced.

The emulator was restarted with explicit DNS servers and its Wi-Fi connection was tested; DNS errors in the application's SKR request remained unresolved. Android System UI also displayed an unresponsive dialog during boot, so this was not an error-free clean-device run.

## Recordings

Supplementary recordings are genuine Android screen captures, without synthetic wallet or gameplay results. Native sharing and haptics preference persistence are in `clockin-native-share-persistence.mp4`. Earlier diagnostic captures show the wallet and SKR failures; they are not a complete gameplay demo.

## Still required

Resolve debug identity verification and the app's RPC connectivity, demonstrate purpose-specific message signing and a real SKR balance lookup, and record an eligible gameplay run, touch controls, completed score image sharing and score persistence. The test wallet has no demonstrated eligible timelock. No access checks were bypassed to fabricate a run. A complete Android demo and physical Seed Vault validation remain unverified.
