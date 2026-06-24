package com.kingbattle.data.service

import android.os.PowerManager
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.kingbattle.data.api.UpdateFcmTokenRequest
import com.kingbattle.di.FcmEntryPoint
import com.kingbattle.util.NotificationHelper
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class KingBattleMessagingService : FirebaseMessagingService() {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed token: $token")

        val entryPoint = EntryPointAccessors.fromApplication(applicationContext, FcmEntryPoint::class.java)
        val tokenManager = entryPoint.tokenManager()
        val api = entryPoint.api()

        tokenManager.saveFcmToken(token)

        if (tokenManager.isLoggedIn()) {
            scope.launch {
                try {
                    val response = api.updateFcmToken(UpdateFcmTokenRequest(token))
                    if (response.isSuccessful) {
                        Log.d(TAG, "Successfully synced new FCM token to server")
                    } else {
                        Log.e(TAG, "Failed to sync new FCM token to server: ${response.code()}")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error syncing new FCM token to server", e)
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "Message received. from=${remoteMessage.from} data=${remoteMessage.data}")

        val wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "KingBattle:FCM")
            .apply { setReferenceCounted(false) }

        try {
            wakeLock.acquire(10_000L)

            val title = remoteMessage.notification?.title
                ?: remoteMessage.data["title"]
                ?: "King Battle"
            val body = remoteMessage.notification?.body
                ?: remoteMessage.data["body"]
                ?: ""
            val link = remoteMessage.data["link"]

            if (body.isBlank()) {
                Log.w(TAG, "Ignoring notification with empty body")
                return
            }

            NotificationHelper.showNotification(applicationContext, title, body, link)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle FCM message", e)
        } finally {
            if (wakeLock.isHeld) {
                wakeLock.release()
            }
        }
    }

    override fun onDestroy() {
        job.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "FCM_SERVICE"
    }
}
