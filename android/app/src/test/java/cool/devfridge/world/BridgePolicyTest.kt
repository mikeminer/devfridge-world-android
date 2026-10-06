package cool.devfridge.world

import org.junit.Assert.*
import org.junit.Test

class BridgePolicyTest {
    @Test fun skrResultIsRejectedAfterReloadEvenWhenTheUrlIsUnchanged() {
        assertTrue(BridgePolicy.acceptsLiveWalletResult(4, 4, BridgePolicy.GAME_URL))
        assertFalse("A completed query must not update a replacement session at the same URL",
            BridgePolicy.acceptsLiveWalletResult(4, 5, BridgePolicy.GAME_URL))
    }
    @Test fun skrResultCannotUnlockPracticeOrAnUntrustedDocument() {
        listOf(BridgePolicy.PRACTICE_URL, "https://evil.test/world/game-v2/index.html", null,
            "https://world.devfridge.cool/android", "http://world.devfridge.cool/world/game-v2/index.html").forEach { url ->
            assertFalse(BridgePolicy.acceptsLiveWalletResult(8, 8, url))
        }
        assertFalse("Returning to live does not restore an earlier document's request",
            BridgePolicy.acceptsLiveWalletResult(8, 10, BridgePolicy.GAME_URL))
    }
    @Test fun aValidWarmRegistrationReturnLeavesPracticeWithoutLosingItsIdentifiers() {
        val request = "a".repeat(43); val run = "0x" + "ab".repeat(32)
        val pending = BridgePolicy.registrationReturn("devfridgeworld://registration?request=$request&run=$run")
        assertNotNull(pending)
        assertEquals(BridgePolicy.GAME_URL, BridgePolicy.registrationDocumentForReturn(BridgePolicy.PRACTICE_URL, pending))
        assertEquals(request, pending!!.request)
        assertEquals(run, pending.run)
        assertNull("The loaded live page must deliver the same return instead of reloading again",
            BridgePolicy.registrationDocumentForReturn(BridgePolicy.GAME_URL, pending))
        assertEquals(BridgePolicy.GAME_URL,
            BridgePolicy.registrationDocumentForReturn(BridgePolicy.PRACTICE_URL, BridgePolicy.RegistrationReturn()))
    }
    @Test fun invalidRegistrationReturnsNeverForcePracticeToNavigate() {
        listOf("devfridgeworld://registration?request=bad&run=0x00", "devfridgeworld://user@registration",
            "https://registration", "devfridgeworld://registration#untrusted").forEach { url ->
            val pending = BridgePolicy.registrationReturn(url)
            assertNull(pending)
            assertNull(BridgePolicy.registrationDocumentForReturn(BridgePolicy.PRACTICE_URL, pending))
        }
        assertNull(BridgePolicy.registrationDocumentForReturn("https://evil.test/world/game-v2/index.html?mode=practice", BridgePolicy.RegistrationReturn()))
    }
    @Test fun practiceModeRequiresExactTrustedRoute() {
        assertTrue(BridgePolicy.isPracticeDocument(BridgePolicy.PRACTICE_URL))
        listOf(BridgePolicy.GAME_URL, "https://evil.test/world/game-v2/index.html?mode=practice", BridgePolicy.PRACTICE_URL + "&mode=live", BridgePolicy.GAME_URL + "?mode=%70ractice").forEach { assertFalse(BridgePolicy.isPracticeDocument(it)) }
    }
    @Test fun registrationLinksCarryIdentifiersOnly() {
        val request = "a".repeat(43); val run = "0x" + "ab".repeat(32)
        assertEquals(BridgePolicy.RegistrationReturn(request, run), BridgePolicy.registrationReturn("devfridgeworld://registration?run=$run&request=$request"))
        assertEquals(BridgePolicy.RegistrationReturn(), BridgePolicy.registrationReturn("devfridgeworld://registration"))
        listOf("https://registration?run=$run&request=$request", "devfridgeworld://user@registration", "devfridgeworld://registration.evil", "devfridgeworld://registration/path", "devfridgeworld://registration#message", "devfridgeworld://registration?run=$run&request=$request&message=evil", "devfridgeworld://registration?request=$request&request=$request", "devfridgeworld://registration?run=$run&request=bad").forEach {
            assertNull(it, BridgePolicy.registrationReturn(it))
        }
    }
    @Test fun onlyTheBundledGameCanUseTheBridge() {
        assertTrue(BridgePolicy.isGameDocument(BridgePolicy.GAME_URL))
        assertTrue(BridgePolicy.isGameDocument("https://world.devfridge.cool/world/game-v2/?player=a#fridge"))
        listOf("http://world.devfridge.cool/world/game-v2/", "https://world.devfridge.cool.evil.test/world/game-v2/",
            "https://world.devfridge.cool:8443/world/game-v2/", "https://user@world.devfridge.cool/world/game-v2/",
            "https://world.devfridge.cool/", "https://world.devfridge.cool/world/game-v2/../index.html",
            "https://world.devfridge.cool/world/game-v2/%2e%2e/index.html", "javascript:alert(1)").forEach {
            assertFalse(it, BridgePolicy.isGameDocument(it))
        }
    }
    @Test fun externalNavigationDoesNotForwardDangerousSchemes() {
        assertTrue(BridgePolicy.externalHttps("https://docs.devfridge.cool/world"))
        listOf("javascript:alert(1)", "file:///sdcard/a", "intent://wallet", "https://user@evil.test/").forEach {
            assertFalse(BridgePolicy.externalHttps(it))
        }
    }
    @Test fun publicKeysKeepLeadingZeroes() {
        assertEquals("11111111111111111111111111111111", BridgePolicy.base58(ByteArray(32)))
        assertEquals("2", BridgePolicy.base58(byteArrayOf(1)))
        assertEquals("12", BridgePolicy.base58(byteArrayOf(0, 1)))
        assertEquals("StV1DL6CwTryKyV", BridgePolicy.base58("hello world".toByteArray()))
    }
}
