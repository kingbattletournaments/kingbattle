package com.kingbattle.data.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.kingbattle.MainActivity
import com.kingbattle.R
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.api.UpdateFcmTokenRequest
import com.kingbattle.data.local.TokenManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class KingBattleMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var api: KingBattleApi

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM_SERVICE", "Refreshed token: $token")
        
        // Save token locally
        tokenManager.saveFcmToken(token)

        // Upload token if logged in
        if (tokenManager.isLoggedIn()) {
            scope.launch {
                try {
                    val response = api.updateFcmToken(UpdateFcmTokenRequest(token))
                    if (response.isSuccessful) {
                        Log.d("FCM_SERVICE", "Successfully synced new FCM token to server")
                    } else {
                        Log.e("FCM_SERVICE", "Failed to sync new FCM token to server: ${response.code()}")
                    }
                } catch (e: Exception) {
                    Log.e("FCM_SERVICE", "Error syncing new FCM token to server", e)
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FCM_SERVICE", "Message received from: ${remoteMessage.from}")

        // Check if message contains notification payload
        remoteMessage.notification?.let {
            val title = it.title ?: "King Battle"
            val body = it.body ?: ""
            val link = remoteMessage.data["link"]
            showNotification(title, body, link)
        } ?: run {
            // Check if message contains data payload
            if (remoteMessage.data.isNotEmpty()) {
                val title = remoteMessage.data["title"] ?: "King Battle"
                val body = remoteMessage.data["body"] ?: ""
                val link = remoteMessage.data["link"]
                showNotification(title, body, link)
            }
        }
    }

    private fun showNotification(title: String, body: String, link: String? = null) {
        val channelId = "king_battle_notifications"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create channel for API 26+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "King Battle Tournament Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts for new tournaments, match results, and announcement updates."
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (!link.isNullOrBlank()) {
                putExtra("notification_link", link)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    override fun onDestroy() {
        job.cancel()
        super.onDestroy()
    }
}
