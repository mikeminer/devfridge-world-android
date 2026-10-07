package cool.devfridge.world

import org.junit.Assert.*
import org.junit.Test

/** Synthetic hostile links exercise the unchanged release policy, not a live wallet. */
class BridgePolicyAdversarialTest {
    @Test fun hostileOriginsSchemesAndEncodedPathsNeverAcquireTheBridge() {
        val attacks = listOf(
            null, "", "javascript:alert(1)", "data:text/html,<script>alert(1)</script>",
            "file:///world/game-v2/index.html", "content://world.devfridge.cool/world/game-v2/index.html",
            "intent://world.devfridge.cool/world/game-v2/index.html", "http://world.devfridge.cool/world/game-v2/",
            "https://world.devfridge.cool.evil.test/world/game-v2/index.html",
            "https://world.devfridge.cool@evil.test/world/game-v2/index.html",
            "https://evil.test@world.devfridge.cool/world/game-v2/index.html",
            "https://world.devfridge.cool./world/game-v2/index.html",
            "https://world.devfridge.cool:8443/world/game-v2/index.html",
            "https://world.devfridge.cool/world/game-v2/../index.html",
            "https://world.devfridge.cool/world/game-v2/%2e%2e/index.html",
            "https://world.devfridge.cool/world/game-v2/%2findex.html",
            "https://world.devfridge.cool/world/game-v2/index.html/extra",
            "https://world.devfridge.cool/world/game-v2/%ZZ",
            "https://world.devfridge.cool/world/game-v2/\u0000index.html",
            "https://world.devfridge.cool\\@evil.test/world/game-v2/index.html"
        )
        attacks.forEach { url ->
            assertFalse("Bridge acquired by $url", BridgePolicy.isGameDocument(url))
            assertFalse("Deferred result accepted by $url", BridgePolicy.acceptsLiveWalletResult(9, 9, url))
        }
        assertTrue(BridgePolicy.isGameDocument(BridgePolicy.GAME_URL))
        assertTrue(BridgePolicy.isGameDocument("https://world.devfridge.cool:443/world/game-v2/index.html"))
    }

    @Test fun registrationReturnsRejectInjectionDuplicateFieldsAndAuthorityConfusion() {
        val request = "a".repeat(43)
        val run = "0x" + "ab".repeat(32)
        val valid = "devfridgeworld://registration?request=$request&run=$run"
        val attacks = listOf(
            "$valid&request=$request", "$valid&run=$run", "$valid&message=%3Cscript%3E",
            "$valid#javascript:alert(1)", valid.replace("registration?", "user@registration?"),
            valid.replace("registration?", "registration:443?"), valid.replace("registration?", "registration.evil?"),
            valid.replace("registration?", "registration/path?"), valid.replace("request=$request", "request=%61" + "a".repeat(42)),
            valid.replace("request=$request", "request=" + "a".repeat(42)),
            valid.replace("request=$request", "request=" + "a".repeat(44)),
            valid.replace("request=$request", "request=%22%3E%3Cimg%20onerror%3Dalert(1)%3E"),
            valid.replace("run=$run", "run=$run%22"), valid.replace("run=$run", "run=javascript:alert(1)"),
            valid.replace("request=", "request[]="), valid.replace("&run=", ";run="),
            valid.replace("devfridgeworld://", "https://"), "devfridgeworld://registration?request=$request"
        )
        attacks.forEach { url ->
            val result = BridgePolicy.registrationReturn(url)
            assertNull("Untrusted return accepted: $url", result)
            assertNull("Malformed return navigated practice", BridgePolicy.registrationDocumentForReturn(BridgePolicy.PRACTICE_URL, result))
        }
        assertEquals(BridgePolicy.RegistrationReturn(request, run), BridgePolicy.registrationReturn(valid))
    }

    @Test fun ambiguousPracticeQueriesDoNotSelectTheNativePracticeDocument() {
        // MainActivity's asset interception uses this same predicate to select practice/index.html.
        val variants = listOf("mode=%70ractice", "mode=practice&mode=live", "mode=live&mode=practice", "mode=practice&x=1", "MODE=practice", "mode=practice%00")
        variants.forEach { query ->
            assertFalse(BridgePolicy.isPracticeDocument(BridgePolicy.GAME_URL + "?" + query))
        }
        assertTrue(BridgePolicy.isPracticeDocument(BridgePolicy.PRACTICE_URL))
        assertFalse(BridgePolicy.acceptsLiveWalletResult(9, 9, BridgePolicy.PRACTICE_URL))
    }

    @Test fun staleAndForeignDocumentsCannotReceiveEarlierWalletResults() {
        listOf(BridgePolicy.PRACTICE_URL, "https://evil.test/world/game-v2/index.html", "https://world.devfridge.cool/android", "https://world.devfridge.cool/world/game-v2/index.html/extra").forEach { url ->
            assertFalse(BridgePolicy.acceptsLiveWalletResult(9, 9, url))
        }
        assertFalse(BridgePolicy.acceptsLiveWalletResult(9, 10, BridgePolicy.GAME_URL))
        assertFalse(BridgePolicy.acceptsLiveWalletResult(9, 11, BridgePolicy.GAME_URL))
        assertTrue(BridgePolicy.acceptsLiveWalletResult(9, 9, BridgePolicy.GAME_URL))
    }
}
