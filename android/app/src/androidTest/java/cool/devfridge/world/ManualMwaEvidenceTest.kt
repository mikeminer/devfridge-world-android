package cool.devfridge.world

import android.graphics.Color
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Manually approved MWA evidence, compiled into the instrumentation APK only.
 * Uses the app's existing wallet-standard bridge and native SKR disclosure.
 * Does not alter compliance, timelock eligibility, score verification, or RPC results.
 * Run only with the official Fake Wallet and newly generated unfunded test keys.
 */
@RunWith(AndroidJUnit4::class)
class ManualMwaEvidenceTest {
    @Test fun manuallyApprovedConnectSignAndReadOnlySkr() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
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
            while (js(scenario, "!!window.DevFridgeMobile") != "true" && System.currentTimeMillis() < readyDeadline) Thread.sleep(200)
            assertEquals("Bundled native wallet bridge must be ready", "true", js(scenario, "!!window.DevFridgeMobile"))
            js(scenario, """
                window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', {
                  detail: { register: wallet => window.__mwaEvidenceWallet = wallet }
                }));
                window.__mwaEvidence = {
                  context: 'Android instrumentation diagnostic; official Fake Wallet test keys',
                  productionAuthorization: false,
                  financialTransactionRequested: false,
                  startedAt: new Date().toISOString(),
                  status: 'Ready: connect the official Fake Wallet',
                  events: []
                };
                window.__mwaEvidenceAppend = (action, result) => {
                  window.__mwaEvidence.events.push({action, at:new Date().toISOString(), ...result});
                  window.__mwaEvidence.status = result.error ? action + ': ' + result.error :
                    action === 'connect' ? 'Connected: ' + result.address.slice(0,8) + '…' + result.address.slice(-6) :
                    action === 'signMessage' ? 'Message signed · 64 bytes · independent verification pending' :
                    action + ' completed';
                };
            """.trimIndent())
            assertEquals("The app's real wallet-standard provider must be discoverable", "true", js(scenario, "!!window.__mwaEvidenceWallet"))
            lateinit var status: TextView
            scenario.onActivity { activity ->
                val web = MainActivity::class.java.getDeclaredField("web").apply { isAccessible = true }.get(activity) as WebView
                val root = web.parent as LinearLayout
                val panel = LinearLayout(activity).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(12, 10, 12, 10)
                    setBackgroundColor(Color.rgb(58, 37, 0))
                }
                panel.addView(TextView(activity).apply {
                    text = "MWA TEST · official Fake Wallet test keys\nNot game access, a ranked score or a payment"
                    setTextColor(Color.WHITE)
                    textSize = 13f
                })
                status = TextView(activity).apply { text = "Ready"; setTextColor(Color.YELLOW); textSize = 12f }
                panel.addView(status)
                val buttons = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL }
                fun button(label: String, action: () -> Unit) {
                    buttons.addView(Button(activity).apply {
                        text = label; textSize = 10f; contentDescription = "MWA evidence $label"
                        setOnClickListener { action() }
                    }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                }
                button("Connect") {
                    web.evaluateJavascript("""
                      window.__mwaEvidence.status='Waiting for wallet authorization';
                      window.__mwaEvidenceWallet.features['standard:connect'].connect()
                        .then(result => {
                          const account=result.accounts[0];
                          window.__mwaEvidence.account={address:account.address,
                            publicKey:btoa(Array.from(account.publicKey,n=>String.fromCharCode(n)).join(''))};
                          window.__mwaEvidenceAppend('connect',{address:account.address});
                        }).catch(e=>window.__mwaEvidenceAppend('connect',{error:e.message}));
                    """.trimIndent(), null)
                }
                button("Sign test") {
                    web.evaluateJavascript("""
                      (async()=>{
                        try {
                          const wallet=window.__mwaEvidenceWallet;
                          const account=wallet.accounts[0];
                          if(!account)throw Error('Connect the test wallet first');
                          const message='DevFridge World Android MWA diagnostic\n'+
                            'Domain: https://world.devfridge.cool\n'+
                            'Account: '+account.address+'\n'+
                            'Nonce: '+crypto.randomUUID()+'\n'+
                            'Issued at: '+new Date().toISOString()+'\n'+
                            'Purpose: verify message signing with an unfunded SDK test wallet.\n'+
                            'This is not game access, score registration, a transaction or a payment.';
                          window.__mwaEvidence.status='Waiting for diagnostic-message approval';
                          const bytes=new TextEncoder().encode(message);
                          const signed=(await wallet.features['solana:signMessage'].signMessage({account,message:bytes}))[0];
                          if(signed.signature.length!==64)throw Error('Invalid signature size');
                          if(signed.signedMessage.length!==bytes.length||signed.signedMessage.some((n,i)=>n!==bytes[i]))throw Error('Wallet changed message bytes');
                          window.__mwaEvidence.signature={
                            message,
                            messageBase64:btoa(Array.from(bytes,n=>String.fromCharCode(n)).join('')),
                            signatureBase64:btoa(Array.from(signed.signature,n=>String.fromCharCode(n)).join('')),
                            address:account.address,
                            publicKeyBase64:btoa(Array.from(account.publicKey,n=>String.fromCharCode(n)).join('')),
                            independentlyVerified:false
                          };
                          window.__mwaEvidenceAppend('signMessage',{signatureBytes:signed.signature.length});
                        }catch(e){window.__mwaEvidenceAppend('signMessage',{error:e.message});}
                      })();
                    """.trimIndent(), null)
                }
                button("Check SKR") {
                    // Real production consent and optional read-only query, not a stubbed balance.
                    MainActivity::class.java.getDeclaredMethod("confirmSkrCheck").apply { isAccessible = true }.invoke(activity)
                }
                button("Finish") { finished.countDown() }
                panel.addView(buttons)
                root.addView(panel, root.indexOfChild(web))
            }
            var lastSkrDialog = ""
            val observedWalletPackages = linkedSetOf<String>()
            val deadline = System.currentTimeMillis() + maxSeconds * 1000L
            while (finished.count != 0L && System.currentTimeMillis() < deadline) {
                val state = js(scenario, "window.__mwaEvidence.status")
                scenario.onActivity { status.text = runCatching { org.json.JSONArray("[$state]").getString(0) }.getOrDefault(state) }
                val node = instrumentation.uiAutomation.rootInActiveWindow
                node?.packageName?.toString()?.takeIf { it.contains("fakewallet") || it == "com.solana.mwallet" }
                    ?.let(observedWalletPackages::add)
                if (node?.packageName?.toString() == "cool.devfridge.world") {
                    val visible = visibleText(node)
                    val resultTitle = listOf("SKR check unavailable", "SKR not found", "Aurora unlocked").firstOrNull { visible.contains(it) }
                    if (resultTitle != null && visible != lastSkrDialog) {
                        lastSkrDialog = visible
                        js(scenario, "window.__mwaEvidenceAppend('skrDialog',{title:${JSONObject.quote(resultTitle)},visibleText:${JSONObject.quote(visible)}})")
                    }
                }
                // Continuously export only public diagnostic data so an interrupted recording is recoverable.
                output.writeText(unquoteJson(js(scenario, "JSON.stringify(window.__mwaEvidence)")))
                Thread.sleep(500)
            }
            val result = JSONObject(unquoteJson(js(scenario, "JSON.stringify(window.__mwaEvidence)")))
                .put("finishedAt", java.time.Instant.now().toString())
                .put("manualFinish", finished.count == 0L)
                .put("observedWalletPackages", org.json.JSONArray(observedWalletPackages.toList()))
            output.writeText(result.toString(2))
            android.util.Log.i("DevFridgeMwaEvidence", "Diagnostic exported to ${output.name}; signature present=${result.has("signature")}")
            assertTrue("Manual session timed out; the partial diagnostic remains available", finished.count == 0L)
            assertTrue("The official Fake Wallet must have appeared during this diagnostic",
                "com.solana.mobilewalletadapter.fakewallet" in observedWalletPackages)
            assertTrue("A successful real MWA diagnostic signature is required; inspect exported errors", result.has("signature"))
        }
    }

    private fun visibleText(node: android.view.accessibility.AccessibilityNodeInfo?): String {
        if (node == null) return ""
        return listOf(node.text?.toString().orEmpty(), (0 until node.childCount).joinToString(" ") { visibleText(node.getChild(it)) })
            .filter(String::isNotBlank).joinToString(" ")
    }

    private fun unquoteJson(value: String): String = org.json.JSONArray("[$value]").getString(0)

    private fun js(scenario: ActivityScenario<MainActivity>, script: String): String {
        val done = CountDownLatch(1)
        var result = ""
        scenario.onActivity { activity ->
            val web = MainActivity::class.java.getDeclaredField("web").apply { isAccessible = true }.get(activity) as WebView
            web.evaluateJavascript(script) { result = it; done.countDown() }
        }
        assertTrue("The WebView callback timed out", done.await(15, TimeUnit.SECONDS))
        return result
    }
}
