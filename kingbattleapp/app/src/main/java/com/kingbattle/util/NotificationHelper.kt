package com.kingbattle.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.kingbattle.MainActivity
import com.kingbattle.R

object NotificationHelper {
    const val CHANNEL_ID = "king_battle_alerts_v4"
    private val LEGACY_CHANNEL_IDS = listOf(
        "king_battle_notifications",
        "king_battle_alerts_v2",
        "king_battle_alerts_v3",
    )
    private const val TAG = "NotificationHelper"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        LEGACY_CHANNEL_IDS.forEach { legacyId ->
            manager.deleteNotificationChannel(legacyId)
        }

        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) {
            if (existing.importance >= NotificationManager.IMPORTANCE_HIGH) {
                return
            }
            Log.w(TAG, "Recreating muted/low channel: $CHANNEL_ID (importance=${existing.importance})")
            manager.deleteNotificationChannel(CHANNEL_ID)
        }

        val channel = NotificationChannel(
            CHANNEL_ID,
            "King Battle Alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Tournament alerts, match updates, and admin broadcasts."
            enableVibration(true)
            enableLights(true)
            setShowBadge(true)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
        Log.d(TAG, "Notification channel ready: $CHANNEL_ID")
    }

    fun canPostNotifications(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS,
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                return false
            }
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    fun logNotificationState(context: Context, source: String) {
        val manager = NotificationManagerCompat.from(context)
        val channel = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.getNotificationChannel(CHANNEL_ID)
        } else {
            null
        }
        Log.d(
            TAG,
            "$source: appEnabled=${manager.areNotificationsEnabled()}, " +
                "canPost=${canPostNotifications(context)}, " +
                "channelImportance=${channel?.importance ?: "n/a"}",
        )
    }

    fun openNotificationSettings(context: Context) {
        val intent = Intent().apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                action = Settings.ACTION_APP_NOTIFICATION_SETTINGS
                putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            } else {
                action = Settings.ACTION_APPLICATION_DETAILS_SETTINGS
                data = android.net.Uri.fromParts("package", context.packageName, null)
            }
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    fun showNotification(context: Context, title: String, body: String, link: String? = null) {
        createNotificationChannel(context)
        logNotificationState(context, "showNotification")

        if (!canPostNotifications(context)) {
            Log.w(TAG, "Cannot post notification — permission or app notifications disabled")
            return
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            if (!link.isNullOrBlank()) {
                putExtra("notification_link", link)
            }
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(
                (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
                notification,
            )
            Log.d(TAG, "Notification posted: $title")
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to post notification", e)
        }
    }
}
