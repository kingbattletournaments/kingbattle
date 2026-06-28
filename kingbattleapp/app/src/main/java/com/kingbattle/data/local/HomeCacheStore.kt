package com.kingbattle.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.kingbattle.domain.model.AppBanner
import com.kingbattle.domain.model.GameMode
import com.kingbattle.domain.model.ReferralSettings
import com.kingbattle.domain.model.User
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

    fun getCachedUser(): User? {
        val json = prefs.getString(KEY_USER, null) ?: return null
        return runCatching { gson.fromJson(json, User::class.java) }.getOrNull()
    }

    fun getCachedAtMs(): Long = prefs.getLong(KEY_CACHED_AT, 0L)

    /** Stable across routine background refreshes; bumps only when banner/referral images change. */
    fun getImageCacheEpoch(): Long = prefs.getLong(KEY_IMAGE_CACHE_EPOCH, 0L)

    fun hasCachedContent(): Boolean =
        prefs.contains(KEY_MODES) ||
            prefs.contains(KEY_BANNERS) ||
            prefs.contains(KEY_ANNOUNCEMENT) ||
            prefs.contains(KEY_REFERRAL)

    fun hasCachedPlayOrEarnContent(): Boolean =
        !getCachedBanners().isNullOrEmpty() ||
            !getCachedModes().isNullOrEmpty() ||
            getCachedReferralSettings() != null

    fun saveHomeContent(
        modes: List<GameMode>,
        banners: List<AppBanner>,
        announcementText: String?,
        referralSettings: ReferralSettings?,
        user: User? = null,
        imageCacheEpoch: Long = 0L,
    ) {
        prefs.edit()
            .putString(KEY_MODES, gson.toJson(modes))
            .putString(KEY_BANNERS, gson.toJson(banners))
            .putString(KEY_ANNOUNCEMENT, announcementText?.trim().orEmpty())
            .putString(
                KEY_REFERRAL,
                referralSettings?.let { gson.toJson(it) },
            )
            .putString(
                KEY_USER,
                user?.let { gson.toJson(it) },
            )
            .putLong(KEY_IMAGE_CACHE_EPOCH, imageCacheEpoch)
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
        private const val KEY_USER = "user_json"
        private const val KEY_CACHED_AT = "cached_at_ms"
        private const val KEY_IMAGE_CACHE_EPOCH = "image_cache_epoch_ms"

        fun bannersFingerprint(banners: List<AppBanner>): String =
            banners.joinToString("|") { banner ->
                "${banner.id}:${banner.imageUrl}:${banner.linkUrl}:" +
                    "${banner.displayPlayCarousel}:${banner.displayEarn}"
            }

        fun modesFingerprint(modes: List<GameMode>): String =
            modes.joinToString("|") { mode ->
                "${mode.id}:${mode.name}:${mode.image_url.orEmpty()}"
            }

        fun referralFingerprint(settings: ReferralSettings?): String =
            settings?.let {
                "${it.enabled}:${it.rewardCoins}:${it.signupBonus}:${it.bannerUrl}"
            }.orEmpty()

        /** Stable Coil cache epoch derived from banner/referral content — not from fetch time. */
        fun imageCacheEpoch(banners: List<AppBanner>, referral: ReferralSettings?): Long {
            val fingerprint = "${bannersFingerprint(banners)}|${referralFingerprint(referral)}"
            return fingerprint.hashCode().toLong()
        }
    }
}

