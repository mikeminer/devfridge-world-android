package cool.devfridge.world

import android.os.Build
import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.lang.reflect.InvocationTargetException
import java.net.InetAddress
import java.time.Instant

/** Opt-in live network diagnostic. Compiled into the test APK only; never mocks RPC responses. */
@RunWith(AndroidJUnit4::class)
class EmulatorNetworkEvidenceTest {
    @Test fun nativeSkrRequestOverVerifiedHttps() {
        assumeTrue("Explicitly enable the live read-only network diagnostic",
            InstrumentationRegistry.getArguments().getString("networkEvidence") == "true")
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        @Suppress("DEPRECATION")
        val installed = context.packageManager.getPackageInfo(context.packageName, 0)
        val address = "CQDmky2kNKNae5yjDxhrD5eu3mKvYui4AcqZxzr1B5oQ"
        val output = File(context.getExternalFilesDir(null), "native-skr-network-evidence.json")
        val receipt = JSONObject()
            .put("kind", "native SKR network/parser verification; instrumentation only")
            .put("startedAt", Instant.now().toString())
            .put("packageName", context.packageName)
            .put("installedVersionName", installed.versionName)
            .put("installedVersionCode", installed.longVersionCode)
            .put("androidApi", Build.VERSION.SDK_INT)
            .put("deviceModel", Build.MODEL)
            .put("rpcEndpoint", "https://api.mainnet.solana.com")
            .put("method", "getTokenAccountsByOwner")
            .put("commitment", "finalized")
            .put("publicAccount", address)
            .put("accountProvenance", "Public address in the earlier official SDK Fake Wallet diagnostic")
            .put("mint", SkrBalance.MINT)
            .put("mockedResponse", false)
            .put("walletAuthorizationDemonstrated", false)
            .put("walletSigningDemonstrated", false)
            .put("visibleSkrDialogDemonstrated", false)
            .put("scope", "Uses the installed app's unchanged private readSkrAccounts function off the UI thread. Standard HttpsURLConnection certificate validation remains enabled. Does not prove gameplay, a wallet consent flow, an Aurora unlock or a release APK run. Parsed account count is not the raw RPC value count; HTTP status and slot are not exported by this function.")
        val started = SystemClock.elapsedRealtime()
        try {
            receipt.put("resolvedRpcAddresses", JSONArray(InetAddress.getAllByName("api.mainnet.solana.com").map { it.hostAddress }))
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                lateinit var activity: MainActivity
                scenario.onActivity { activity = it }
                val nativeQuery = MainActivity::class.java.getDeclaredMethod("readSkrAccounts", String::class.java)
                    .apply { isAccessible = true }
                // Instrumentation runs on its own thread; do not invoke the blocking request inside onActivity.
                val returned = nativeQuery.invoke(activity, address) as List<*>
                assertTrue("The native parser must return TokenAccount records", returned.all { it is SkrBalance.TokenAccount })
                val accounts = returned.map { it as SkrBalance.TokenAccount }
                val rawBalance = SkrBalance.rawBalance(address, accounts)
                receipt.put("parsedTokenAccountCount", accounts.size)
                    .put("rawSkrBalance", rawBalance.toString())
                    .put("eligible", SkrBalance.eligible(address, accounts))
                    .put("status", "passed")
            }
        } catch (failure: Throwable) {
            val cause = if (failure is InvocationTargetException) failure.targetException else failure
            receipt.put("status", "failed").put("errorType", cause.javaClass.name).put("errorMessage", cause.message)
            throw cause
        } finally {
            receipt.put("finishedAt", Instant.now().toString()).put("elapsedMs", SystemClock.elapsedRealtime() - started)
            output.writeText(receipt.toString(2))
            android.util.Log.i("DevFridgeNetworkEvidence", "Native network diagnostic: ${receipt.optString("status")}; receipt=${output.name}")
        }
    }
}
