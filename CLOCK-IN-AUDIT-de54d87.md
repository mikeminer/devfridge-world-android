# Security Review: devfridge-world-android

Commit: de54d8736838827de79d7cef0e3fc4931bbf5839
Reviewed: 6 October 2026

## Summary

This review read the code in devfridge-world-android and the packages it depends on.

Nothing was confirmed as a defect.

| | High | Medium | Low | Info |
| --- | --- | --- | --- | --- |
| Your code | 5 | 8 | 4 | 0 |
| Packages | 0 | 0 | 0 | 0 |

## What was reviewed

Every part below was read by the same checks. A part with nothing against it had nothing to report, which is not the same as nothing to read.

| Part | Where |
| --- | --- |
| Android | android |
| JavaScript and TypeScript | android, world-game-v2 |

Files read: 146

Checks that ran and finished:

- Patterns in the source code that are known to be unsafe
- Known vulnerabilities in the packages this project depends on
- Credentials committed to the repository
- Server and deployment configuration

## Fix first

Nothing needs attention before anything else.

## Your code

Nothing was confirmed as a defect in the code that was reviewed.

### Worth a look

Each of these matched a pattern that is sometimes a real problem. None has been verified. Read the code before acting on any of them.

### 1. A variable is written into the page as HTML rather than as text.

Severity: High
Location: world-game-v2/src/boot.js:76

What is wrong: If any part of it comes from a user, a URL or an API response, it can carry script that runs with the page's origin and reaches whatever the page holds, including a connected wallet. Assign textContent, or sanitize.

```
document.getElementById("access").hidden = false;
document.getElementById("again").onclick = () => location.reload();

let address = null;
let unlocked = new Set();

function paintChars() {
  const box = document.getElementById("chars");
  box.innerHTML = cast
    .map(
      (c) => `<button data-tier="${c.tier}" class="${unlocked.has(c.tier) ? "unlocked" : ""}">
        <img src="${assetUrl(c.webp)}" alt="${c.name}" width="64" height="64"/>
        <span>${c.name}</span>
      </button>`,
    )
    .join("");
```

### 2. A variable is written into the page as HTML rather than as text.

Severity: High
Location: world-game-v2/src/game.js:170

What is wrong: If any part of it comes from a user, a URL or an API response, it can carry script that runs with the page's origin and reaches whatever the page holds, including a connected wallet. Assign textContent, or sanitize.

```
  const bestEl = root.querySelector("#best");
  const nextImg = root.querySelector("#next-img");
  const collectionEl = root.querySelector("#collection");
  const collectionCount = root.querySelector("#collection-count");
  const bar = root.querySelector("#collection-bar");
  const toast = root.querySelector("#toast");

  function renderCollection() {
    collectionCount.innerHTML = `${discovered.size}<span> / 10</span>`;
    bar.style.width = `${discovered.size * 10}%`;
    collectionEl.innerHTML = cast
      .map(
        (c) =>
          `<button class="cast-card ${discovered.has(c.tier) ? "revealed" : ""}" style="--cast-color:${c.color}"><span class="tier-number">${String(c.tier).padStart(2, "0")}</span><img src="${assetUrl(c.webp)}" alt="" width="64" height="64"/><span class="cast-name">${discovered.has(c.tier) ? c.name : "???"}</span></button>`,
      )
      .join("");
```

### 3. A variable is written into the page as HTML rather than as text.

Severity: High
Location: world-game-v2/src/game.js:172

What is wrong: If any part of it comes from a user, a URL or an API response, it can carry script that runs with the page's origin and reaches whatever the page holds, including a connected wallet. Assign textContent, or sanitize.

```
  const collectionEl = root.querySelector("#collection");
  const collectionCount = root.querySelector("#collection-count");
  const bar = root.querySelector("#collection-bar");
  const toast = root.querySelector("#toast");

  function renderCollection() {
    collectionCount.innerHTML = `${discovered.size}<span> / 10</span>`;
    bar.style.width = `${discovered.size * 10}%`;
    collectionEl.innerHTML = cast
      .map(
        (c) =>
          `<button class="cast-card ${discovered.has(c.tier) ? "revealed" : ""}" style="--cast-color:${c.color}"><span class="tier-number">${String(c.tier).padStart(2, "0")}</span><img src="${assetUrl(c.webp)}" alt="" width="64" height="64"/><span class="cast-name">${discovered.has(c.tier) ? c.name : "???"}</span></button>`,
      )
      .join("");
  }
```

### 4. A variable is written into the page as HTML rather than as text.

Severity: High
Location: world-game-v2/src/game.js:181

What is wrong: If any part of it comes from a user, a URL or an API response, it can carry script that runs with the page's origin and reaches whatever the page holds, including a connected wallet. Assign textContent, or sanitize.

```
      .map(
        (c) =>
          `<button class="cast-card ${discovered.has(c.tier) ? "revealed" : ""}" style="--cast-color:${c.color}"><span class="tier-number">${String(c.tier).padStart(2, "0")}</span><img src="${assetUrl(c.webp)}" alt="" width="64" height="64"/><span class="cast-name">${discovered.has(c.tier) ? c.name : "???"}</span></button>`,
      )
      .join("");
  }

  function flash(title, sub) {
    toast.innerHTML = `<strong>${title}</strong><span>${sub || ""}</span>`;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 900);
  }

  function endRun(kind) {
    localStorage.setItem(`cold-storage-v2:${address}:cast`, JSON.stringify([...discovered]));
    if (merge.score > best) {
```

### 5. A variable is written into the page as HTML rather than as text.

Severity: High
Location: world-game-v2/src/game.js:193

What is wrong: If any part of it comes from a user, a URL or an API response, it can carry script that runs with the page's origin and reaches whatever the page holds, including a connected wallet. Assign textContent, or sanitize.

```

  function endRun(kind) {
    localStorage.setItem(`cold-storage-v2:${address}:cast`, JSON.stringify([...discovered]));
    if (merge.score > best) {
      best = merge.score;
      localStorage.setItem(bestKey, String(best));
    }
    root.querySelector("#result-title").textContent = kind === "win" ? "FRIDGED" : "DOOR OPEN";
    root.querySelector("#result-score").innerHTML = `${merge.score.toLocaleString("en-US")}<span> pts - World v2</span>`;
    root.querySelector("#result").showModal();
  }

  loadFavouriteModel(THREE, loaders, cast, favourite).then((gltf) => {
    if (!gltf || reduced) return;
    const avatar = gltf.scene.clone(true);
    avatar.traverse((n) => {
```

### 6. An exported component has no permission on it, so any app on the device can start it.

Severity: Medium
Location: android/app/src/androidTest/AndroidManifest.xml:5

What is wrong: If it handles wallet actions or deep links, that is a way in.

```
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <!-- Local share destination exists only in the separately installed test APK. -->
        <activity android:name="cool.devfridge.world.ShareReceiptActivity"
            android:exported="true"
            android:label="DevFridge share test"
            android:theme="@android:style/Theme.Material.Light.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="image/png" />
                <data android:mimeType="text/plain" />
            </intent-filter>
        </activity>
    </application>
```

### 7. Data is written to external storage, which is shared and readable by other apps and by anyone who mounts the device.

Severity: Medium
Location: android/app/src/androidTest/java/cool/devfridge/world/EmulatorSmokeTest.kt:94

What is wrong: Anything sensitive, including key material or tokens, must stay in app-private storage.

```
            while (!content.contains("unreserved") && !content.contains("non riservati") && System.currentTimeMillis() < until) {
                content = textOf(automation.rootInActiveWindow)
                Thread.sleep(100)
            }
            assertTrue("Rules must explain the owner safety control", content.contains("unreserved") || content.contains("non riservati"))
            assertTrue("Rules must disclose claim closure", content.contains("minimum claim") || content.contains("durata minima"))
            val screenshot = automation.takeScreenshot()
            val context = InstrumentationRegistry.getInstrumentation().targetContext
            java.io.File(context.getExternalFilesDir(null), "topshelf-rules.png").outputStream().use {
                screenshot.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            screenshot.recycle()
        }
    }
    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
        val done = CountDownLatch(1); var result = ""
```

### 8. Data is written to external storage, which is shared and readable by other apps and by anyone who mounts the device.

Severity: Medium
Location: android/app/src/androidTest/java/cool/devfridge/world/ManualMwaEvidenceTest.kt:41

What is wrong: Anything sensitive, including key material or tokens, must stay in app-private storage.

```
        val arguments = InstrumentationRegistry.getArguments()
        assumeTrue("Enable this manual diagnostic explicitly", arguments.getString("manualMwaEvidence") == "true")
        // This test never imports, reads, or persists a wallet's private key.
        assertTrue("Install the official SDK Fake Wallet before running this diagnostic",
            instrumentation.uiAutomation.executeShellCommand("pm path com.solana.mobilewalletadapter.fakewallet").use {
                java.io.FileInputStream(it.fileDescriptor).bufferedReader().readText().startsWith("package:")
            })
        val finished = CountDownLatch(1)
        val output = File(context.getExternalFilesDir(null), "manual-mwa-evidence.json")
        val maxSeconds = (arguments.getString("manualWaitSeconds")?.toLongOrNull() ?: 300L).coerceIn(60L, 600L)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val web = MainActivity::class.java.getDeclaredField("web").apply { isAccessible = true }.get(activity) as WebView
                web.loadUrl(BridgePolicy.GAME_URL)
            }
            val readyDeadline = System.currentTimeMillis() + 45_000
```

### 9. Data is written to external storage, which is shared and readable by other apps and by anyone who mounts the device.

Severity: Medium
Location: android/app/src/androidTest/java/cool/devfridge/world/StoreScreenshotsTest.kt:103

What is wrong: Anything sensitive, including key material or tokens, must stay in app-private storage.

```
        }
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            dismissSystemUiAnr()
            Thread.sleep(2000)
            scenario.onActivity { activity ->
                MainActivity::class.java.getDeclaredMethod("showDocument", String::class.java, String::class.java).apply { isAccessible = true }.invoke(activity, "TopShelf rules", "topshelf")
            }
            instrumentation.waitForIdleSync()
            Thread.sleep(1000)
            val bitmap = instrumentation.uiAutomation.takeScreenshot()
            File(instrumentation.targetContext.getExternalFilesDir(null), "04-topshelf-rules.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
            bitmap.recycle()
        }
    }
}
```

### 10. Data is written to external storage, which is shared and readable by other apps and by anyone who mounts the device.

Severity: Medium
Location: android/app/src/androidTest/java/cool/devfridge/world/StoreScreenshotsTest.kt:55

What is wrong: Anything sensitive, including key material or tokens, must stay in app-private storage.

```
            while (js("!!window.DevFridgeRegistration") != "true" && System.currentTimeMillis() < until) Thread.sleep(200)
            assertTrue(js("!!window.DevFridgeRegistration") == "true")
            fun capture(name: String) {
                dismissSystemUiAnr()
                instrumentation.waitForIdleSync()
                Thread.sleep(1000)
                val bitmap = instrumentation.uiAutomation.takeScreenshot()
                assertTrue("Capture must be portrait 9:16", bitmap.width * 16 == bitmap.height * 9)
                File(instrumentation.targetContext.getExternalFilesDir(null), name).outputStream().use {
                    bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
                }
                bitmap.recycle()
            }
            Thread.sleep(5000)
            assertTrue("Server TLS must succeed before capturing", !js("document.body.innerText").contains("Cannot connect securely"))
            capture("01-welcome.png")
```

### 11. Data is written to external storage, which is shared and readable by other apps and by anyone who mounts the device.

Severity: Medium
Location: android/app/src/androidTest/java/cool/devfridge/world/StoreScreenshotsTest.kt:91

What is wrong: Anything sensitive, including key material or tokens, must stay in app-private storage.

```
                assertTrue(latch.await(10,TimeUnit.SECONDS))
                Thread.sleep(200)
            }
            assertTrue("Saved score dialog must be open", opened)
            dismissSystemUiAnr()
            instrumentation.waitForIdleSync()
            Thread.sleep(1500)
            val bitmap = instrumentation.uiAutomation.takeScreenshot()
            File(instrumentation.targetContext.getExternalFilesDir(null), "03-saved-scores.png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }
            bitmap.recycle()
        }
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            dismissSystemUiAnr()
            Thread.sleep(2000)
            scenario.onActivity { activity ->
                MainActivity::class.java.getDeclaredMethod("showDocument", String::class.java, String::class.java).apply { isAccessible = true }.invoke(activity, "TopShelf rules", "topshelf")
```

### 12. An exported component has no permission on it, so any app on the device can start it.

Severity: Medium
Location: android/app/src/main/AndroidManifest.xml:14

What is wrong: If it handles wallet actions or deep links, that is a way in.

```
    <queries>
        <package android:name="app.phantom" />
        <intent><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="solana-wallet" /></intent>
    </queries>
    <application android:label="DevFridge World" android:icon="@drawable/ic_world_title"
        android:theme="@style/AppTheme" android:allowBackup="false" android:dataExtractionRules="@xml/data_extraction_rules"
        android:usesCleartextTraffic="false" android:networkSecurityConfig="@xml/network_security_config"
        android:supportsRtl="true">
        <activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:windowSoftInputMode="adjustResize">
            <intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>
            <intent-filter><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.DEFAULT" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="devfridgeworld" android:host="registration" /></intent-filter>
        </activity>
        <provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.files"
            android:exported="false" android:grantUriPermissions="true">
```

### 13. A non-local http:// endpoint is hardcoded.

Severity: Medium
Location: android/mobile/native-bridge.js:42

What is wrong: Traffic to it can be read and rewritten by anyone on the network path, including responses the program then acts on. Use https.

```
  };

  let account;
  const listeners = new Set();
  const emitAccounts = () => listeners.forEach(listener => listener({ accounts: wallet.accounts }));
  const wallet = Object.freeze({
    version: '1.0.0',
    name: 'Android wallet - Solana Mobile',
    icon: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#17231c"/><path fill="#c1ec73" d="M19 9h26v46H19z"/><path fill="#17231c" d="M23 13h18v14H23zm0 18h18v20H23z"/></svg>'),
    chains: Object.freeze(['solana:mainnet']),
    get accounts() { return account ? [account] : []; },
    features: {
      'standard:connect': { version: '1.0.0', async connect(options = {}) {
        if (options.silent) return { accounts: wallet.accounts };
        const result = await request('connect');
        const publicKey = decode(result.publicKey);
```

### 14. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: scan/app/api/world/faction/route.ts:2

What is wrong: New work should use @solana/kit.

```
import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { factionForWallet } from "@/lib/world-faction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get("wallet") || "").trim();
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ error: "wallet required" }, { status: 400 });
  }
  try {
    const faction = await factionForWallet(wallet);
```

### 15. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: scan/app/api/world/topshelf/best/route.ts:2

What is wrong: New work should use @solana/kit.

```
import {NextRequest, NextResponse} from 'next/server';
import {PublicKey} from '@solana/web3.js';
import {readPlayerBest} from '@/lib/topshelf/server';

export const dynamic = 'force-dynamic';
const headers = {'Cache-Control': 'no-store'};

function solanaWallet(value: string | null) {
  try {
    if (!value) throw Error();
    const key = new PublicKey(value);
    if (!PublicKey.isOnCurve(key.toBytes())) throw Error();
    return key.toBase58();
  } catch {
    return null;
  }
```

### 16. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: scan/lib/topshelf/registration.ts:3

What is wrong: New work should use @solana/kit.

```
import {randomBytes} from 'node:crypto';
import {Wallet, getAddress, hexlify, keccak256, toUtf8Bytes, ZeroAddress, ZeroHash} from 'ethers';
import {PublicKey} from '@solana/web3.js';
import nacl from 'tweetnacl';
import {locksForDepositor} from '../fridge';
import {shelfConnection} from './server';
import {TOPSHELF_CHAIN} from './config';
import {RegistrationError, seal, unseal, scoreStore, scoreRateLimit} from './registration-security';
import {SCORE_TYPES, registrationMessage, type RunTicket, type ScoreChallenge} from './score-protocol';
import rules from './engine/rules.json';
import tokens from './engine/tokens.json';
import {dailySeed} from './engine/core';
import {createLiveRun,advanceLiveRun,finishedLiveRun} from './live-run';
import {assertNotExcluded,appendLog} from '../world-compliance';
import {liveWorkerConfigured,proxyLive} from './live-proxy';
```

### 17. This code imports @solana/web3.js v1, which is in maintenance and no longer where fixes land first.

Severity: Low
Location: scan/lib/topshelf/server.ts:2

What is wrong: New work should use @solana/kit.

```
import {Contract, FetchRequest, JsonRpcProvider, isAddress, ZeroAddress, getAddress, hexlify} from 'ethers';
import {PublicKey} from '@solana/web3.js';
import {TOPSHELF_ABI, TOPSHELF_CHAIN, TOPSHELF_OWNER, ERC20_ABI, type FeeMenu, type FeeToken, type ShelfData, type ShelfToken} from './config';
import {ROBINHOOD_TOKENS} from '../official-tokens';
export function shelfConnection() {
 const address=process.env.TOPSHELF_CONTRACT_ADDRESS;
 if(!address) return null;
 if(!isAddress(address)||address===ZeroAddress) throw Error('Invalid TopShelf deployment configuration');
 const request=new FetchRequest(process.env.ROBINHOOD_RPC_URL||'https://rpc.mainnet.chain.robinhood.com');request.timeout=12000;
 const provider=new JsonRpcProvider(request,TOPSHELF_CHAIN,{staticNetwork:true});
 return {address:getAddress(address),provider,contract:new Contract(address,TOPSHELF_ABI,provider)};
}
let feeCache:{value:FeeMenu;expires:number;staleUntil:number}|null=null;
let feeRequest:Promise<FeeMenu>|null=null;
async function fetchFeeMenu():Promise<FeeMenu> {
 const connection=shelfConnection();
```
