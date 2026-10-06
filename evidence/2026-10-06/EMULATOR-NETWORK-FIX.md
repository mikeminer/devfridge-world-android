# Emulator network repair — 6 October 2026

The DevFridgeDemo Android 15/API 35 emulator had guest Wi-Fi disabled (`wifi_on=0`) and mobile data disabled. It had no usable default network. DNS/proxy workarounds attempted earlier did not establish app connectivity.

Enabling guest Wi-Fi with `adb -s emulator-5558 shell svc wifi enable` connected AndroidWifi and assigned IPv4 `10.0.2.16`. Android reported a validated default network, gateway `10.0.2.2` and DNS `10.0.2.3`. After a restart without loading or saving snapshots, Wi-Fi remained enabled and DNS resolution and ICMP to `api.mainnet.solana.com` passed. No data wipe, main-app reinstall, host firewall change, proxy or custom DNS service was used for this repair.

## Native HTTPS verification

The opt-in `EmulatorNetworkEvidenceTest` was compiled into the instrumentation APK only and run against the already-installed debug app, **0.3.2-beta.1 / versionCode 8**. Only the instrumentation APK was installed. The test invoked the installed app's unchanged `MainActivity.readSkrAccounts` on the instrumentation thread and used its real mainnet `getTokenAccountsByOwner` request and native parser. The public account was the address recorded in the earlier official SDK Fake Wallet diagnostic.

The test passed at `2026-10-06T15:26:02Z`: DNS resolved, the native request returned normally, zero token-account records were parsed, the filtered raw SKR balance was `0` and eligibility was `false`. This was a live read-only request with no mocked response or financial transaction. The result is a network/parser success; it is not an Aurora unlock.

The native function rejects HTTP and JSON-RPC errors but does not export raw HTTP status, slot or raw `result.value` count. It skips malformed individual account records. Therefore zero parsed records are not independent proof that the raw RPC array was empty.

Certificate validation was not disabled by the diagnostic. The installed debug app has a separate emulator build history; this test did not audit its trust-store/build flags and does not establish release TLS behavior. The optional local debug TLS helper in source limits its extra trust anchor to `world.devfridge.cool`. No changes to the production native network function or release APK were required by this repair.

This run does not demonstrate a new wallet authorization/signature, visible SKR consent/result dialog, gameplay, positive SKR holdings or execution of the signed beta.2 release. The earlier demo and its SKR failure receipt remain unchanged as historical evidence. The app was reopened after the diagnostic; its stored data was retained.

## Receipts and reproduction

`emulator-network-fixed-connectivity.json` records the separate ADB network observations after restart. `native-skr-network-evidence.json` is the JSON exported by the Android instrumentation process. `emulator-native-network-test.txt` records `OK (1 test)`.

With the debug app already installed and the matching test signing key, build and install only the instrumentation APK, then explicitly enable the read-only test:

```powershell
cd android
.\gradlew.bat :app:assembleDebugAndroidTest
adb -s emulator-5558 install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5558 shell am instrument -w -r -e networkEvidence true -e class cool.devfridge.world.EmulatorNetworkEvidenceTest cool.devfridge.world.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5558 pull /sdcard/Android/data/cool.devfridge.world/files/native-skr-network-evidence.json
```

The network diagnostic is skipped unless `networkEvidence=true` is supplied. It performs a real RPC request, launches and closes the app activity, and exports only public diagnostic data. It never imports or reads private keys.
