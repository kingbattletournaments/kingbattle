package com.kingbattle

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.kingbattle.di.CoilEntryPoint
import com.kingbattle.util.NotificationHelper
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.android.EntryPointAccessors

@HiltAndroidApp
class KingBattleApp : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createNotificationChannel(this)
    }

    override fun newImageLoader(): ImageLoader {
        val okHttpClient = EntryPointAccessors.fromApplication(
            this,
            CoilEntryPoint::class.java,
        ).okHttpClient()

        return ImageLoader.Builder(this)
            .okHttpClient(okHttpClient)
            .crossfade(false)
            .allowHardware(true)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.25)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.08)
                    .build()
            }
            .build()
    }
}
