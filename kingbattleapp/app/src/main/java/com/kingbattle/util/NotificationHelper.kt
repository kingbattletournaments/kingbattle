package com.kingbattle.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.kingbattle.MainActivity
import com.kingbattle.R

object NotificationHelper {
    const val CHANNEL_ID = "king_battle_alerts_v2"
    private const val LEGACY_CHANNEL_ID = "king_battle_notifications"
    private const val TAG = "NotificationHelper"
    private const val MAX_LARGE_ICON_PX = 256

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)

        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "King Battle Alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Tournament alerts, match updates, and admin broadcasts."
            enableVibration(true)
            enableLights(true)
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
        Log.d(TAG, "Notification channel created: $CHANNEL_ID")
    }

    fun canPostNotifications(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    fun showNotification(context: Context, title: String, body: String, link: String? = null) {
        try {
            createNotificationChannel(context)

            if (!canPostNotifications(context)) {
                Log.w(TAG, "Cannot post notification — permission disabled")
                return
            }

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
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

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setColorized(false)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent)

            try {
                buildLargeNotificationIcon(context)?.let { builder.setLargeIcon(it) }
            } catch (e: Exception) {
                Log.w(TAG, "Skipping large icon; posting with small icon only", e)
            }

            NotificationManagerCompat.from(context).notify(
                (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
                builder.build(),
            )
            Log.d(TAG, "Notification posted: $title")
        } catch (e: SecurityException) {
            Log.e(TAG, "Failed to post notification — permission", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show notification", e)
        }
    }

    private fun buildLargeNotificationIcon(context: Context): Bitmap? {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeResource(context.resources, R.drawable.app_logo, options)
        if (options.outWidth <= 0 || options.outHeight <= 0) return null

        val sampleSize = calculateInSampleSize(options, MAX_LARGE_ICON_PX)
        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val decoded = BitmapFactory.decodeResource(context.resources, R.drawable.app_logo, decodeOptions)
            ?: return null

        return if (decoded.width == MAX_LARGE_ICON_PX && decoded.height == MAX_LARGE_ICON_PX) {
            decoded
        } else {
            Bitmap.createScaledBitmap(decoded, MAX_LARGE_ICON_PX, MAX_LARGE_ICON_PX, true).also {
                if (it !== decoded) decoded.recycle()
            }
        }
    }

    private fun calculateInSampleSize(options: BitmapFactory.Options, maxSize: Int): Int {
        var inSampleSize = 1
        var width = options.outWidth
        var height = options.outHeight
        while (width / inSampleSize > maxSize * 2 || height / inSampleSize > maxSize * 2) {
            inSampleSize *= 2
        }
        return inSampleSize
    }
}
