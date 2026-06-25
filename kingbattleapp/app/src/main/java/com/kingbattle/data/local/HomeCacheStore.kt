package com.kingbattle.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.kingbattle.domain.model.AppBanner
import com.kingbattle.domain.model.GameMode
import com.kingbattle.domain.model.ReferralSettings
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HomeCacheStore @Inject constructor(
    @ApplicationContext context: Context,
    private val gson: Gson,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getCachedModes(): List<GameMode>? = readList(KEY_MODES)

    fun getCachedBanners(): List<AppBanner>? = readList(KEY_BANNERS)

    fun getCachedAnnouncement(): String? =
        prefs.getString(KEY_ANNOUNCEMENT, null)?.takeIf { it.isNotBlank() }

    fun getCachedReferralSettings(): ReferralSettings? {
        val json = prefs.getString(KEY_REFERRAL, null) ?: return null
        return runCatching { gson.fromJson(json, ReferralSettings::class.java) }.getOrNull()
    }

    fun getCachedAtMs(): Long = prefs.getLong(KEY_CACHED_AT, 0L)

    fun hasCachedContent(): Boolean =
        prefs.contains(KEY_MODES) || prefs.contains(KEY_BANNERS)

    fun isContentFresh(nowMs: Long = System.currentTimeMillis()): Boolean {
        val cachedAt = getCachedAtMs()
        if (cachedAt <= 0L) return false
        return nowMs - cachedAt < STALE_MS
    }

    fun saveHomeContent(
        modes: List<GameMode>,
        banners: List<AppBanner>,
        announcementText: String?,
        referralSettings: ReferralSettings?,
    ) {
        prefs.edit()
            .putString(KEY_MODES, gson.toJson(modes))
            .putString(KEY_BANNERS, gson.toJson(banners))
            .putString(KEY_ANNOUNCEMENT, announcementText?.trim().orEmpty())
            .putString(
                KEY_REFERRAL,
                referralSettings?.let { gson.toJson(it) },
            )
            .putLong(KEY_CACHED_AT, System.currentTimeMillis())
            .apply()
    }

    private inline fun <reified T> readList(key: String): List<T>? {
        val json = prefs.getString(key, null) ?: return null
        return runCatching {
            gson.fromJson<List<T>>(json, object : TypeToken<List<T>>() {}.type)
        }.getOrNull()
    }

    companion object {
        private const val PREFS_NAME = "king_battle_home_cache"
        private const val KEY_MODES = "modes_json"
        private const val KEY_BANNERS = "banners_json"
        private const val KEY_ANNOUNCEMENT = "announcement"
        private const val KEY_REFERRAL = "referral_json"
        private const val KEY_CACHED_AT = "cached_at_ms"

        /** Background refresh interval for modes/banners. */
        const val STALE_MS = 30L * 60 * 1000
    }
}
