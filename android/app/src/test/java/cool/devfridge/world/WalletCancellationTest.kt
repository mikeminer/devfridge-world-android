package cool.devfridge.world

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

/** Real coroutine cancellation semantics with synthetic document states; no Android or wallet execution. */
class WalletCancellationTest {
    @Test fun cancelledWalletFutureRepliesOnceWhileTheRequestingJobAndDocumentAreLive() = runBlocking {
        val futureCancelled = CancellationException("Synthetic RPC future cancellation")
        var replies = 0
        try {
            throw futureCancelled
        } catch (failure: CancellationException) {
            replyToCurrentWalletCancellation(failure, {
                BridgePolicy.acceptsLiveWalletResult(7, 7, BridgePolicy.GAME_URL)
            }) { replies++ }
        }
        assertEquals(1, replies)
    }

    @Test fun cancelledActivityJobCannotReplyEvenIfItsDocumentStillLooksCurrent() = runBlocking {
        val futureCancelled = CancellationException("Synthetic RPC future cancellation")
        var replies = 0
        var currentDocumentRead = false
        var propagated: CancellationException? = null
        val activityJob = launch(start = CoroutineStart.UNDISPATCHED) {
            cancel(CancellationException("Synthetic Activity destruction"))
            try {
                replyToCurrentWalletCancellation(futureCancelled, {
                    currentDocumentRead = true
                    true
                }) { replies++ }
            } catch (failure: CancellationException) {
                propagated = failure
            }
        }
        activityJob.join()
        assertSame(futureCancelled, propagated)
        assertFalse(currentDocumentRead)
        assertEquals(0, replies)
    }

    @Test fun replacedReloadedPracticeOrForeignDocumentsNeverReceiveTheOldCancellationReply() = runBlocking {
        val states = listOf(
            Triple(7, 8, BridgePolicy.GAME_URL),
            Triple(7, 7, BridgePolicy.PRACTICE_URL),
            Triple(7, 7, "https://world.devfridge.cool.evil.test/world/game-v2/index.html"),
            Triple(7, 7, null)
        )
        for ((requestEpoch, currentEpoch, url) in states) {
            val futureCancelled = CancellationException("Synthetic RPC future cancellation")
            var replies = 0
            var propagated: CancellationException? = null
            try {
                replyToCurrentWalletCancellation(futureCancelled, {
                    BridgePolicy.acceptsLiveWalletResult(requestEpoch, currentEpoch, url)
                }) { replies++ }
            } catch (failure: CancellationException) {
                propagated = failure
            }
            assertSame(futureCancelled, propagated)
            assertEquals(0, replies)
        }
    }
}
