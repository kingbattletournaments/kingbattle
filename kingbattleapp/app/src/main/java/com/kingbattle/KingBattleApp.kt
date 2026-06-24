package com.kingbattle

import android.app.Application
import com.kingbattle.util.NotificationHelper
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class KingBattleApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createNotificationChannel(this)
    }
}
