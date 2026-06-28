package com.kingbattle.presentation.home

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.Coil
import coil.annotation.ExperimentalCoilApi
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.local.HomeCacheStore
import com.kingbattle.domain.model.AppBanner
import com.kingbattle.domain.model.GameMode
import com.kingbattle.domain.model.ReferralSettings
import com.kingbattle.domain.model.User
import com.kingbattle.util.NetworkUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: KingBattleApi,
    private val homeCacheStore: HomeCacheStore,
) : ViewModel() {

    private val _modes = MutableStateFlow<List<GameMode>>(emptyList())
    val modes: StateFlow<List<GameMode>> = _modes.asStateFlow()

    private val _announcementText = MutableStateFlow("")
    val announcementText: StateFlow<String> = _announcementText.asStateFlow()

    private val _banners = MutableStateFlow<List<AppBanner>>(emptyList())
    val banners: StateFlow<List<AppBanner>> = _banners.asStateFlow()

    private val _leaderboard = MutableStateFlow<List<com.kingbattle.domain.model.LeaderboardUser>>(emptyList())
    val leaderboard: StateFlow<List<com.kingbattle.domain.model.LeaderboardUser>> = _leaderboard.asStateFlow()

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _supportUrl = MutableStateFlow("")
    val supportUrl: StateFlow<String> = _supportUrl.asStateFlow()

    private val _referralSettings = MutableStateFlow<ReferralSettings?>(null)
    val referralSettings: StateFlow<ReferralSettings?> = _referralSettings.asStateFlow()

    /** True once cached Play/Earn content has been applied — UI can skip skeletons. */
    private val _hasCachedHomeContent = MutableStateFlow(false)
    val hasCachedHomeContent: StateFlow<Boolean> = _hasCachedHomeContent.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    /** Bumps only when banner/referral images change or user force-refreshes. */
    private val _contentRefreshEpoch = MutableStateFlow(0L)
    val contentRefreshEpoch: StateFlow<Long> = _contentRefreshEpoch.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        applyCacheFromStore()
        loadData(force = false)
    }

    fun refreshHomeContent() {
        loadData(force = true)
    }

    fun loadData(force: Boolean = false) {
        viewModelScope.launch {
            val hasCache = _hasCachedHomeContent.value || homeCacheStore.hasCachedPlayOrEarnContent()
            val showBlockingLoader = !force && !hasCache

            if (showBlockingLoader) {
                _isLoading.value = true
            } else if (force) {
                _isRefreshing.value = true
            }
            _errorMessage.value = null

            if (!NetworkUtils.isOnline(context)) {
                _isOffline.value = true
                if (!hasCache) {
                    _errorMessage.value =
                        "No internet connection. Connect to load live tournaments and wallet data."
                }
                _isLoading.value = false
                _isRefreshing.value = false
                return@launch
            }

            _isOffline.value = false
            if (force) {
                _contentRefreshEpoch.value = System.currentTimeMillis()
                clearImageCaches()
            }
            fetchFromNetwork(force = force)
            _isLoading.value = false
            _isRefreshing.value = false
        }
    }

    private suspend fun fetchFromNetwork(force: Boolean) {
        var fetchedModes = _modes.value
        var fetchedBanners = _banners.value
        var fetchedAnnouncement = _announcementText.value
        var fetchedReferral = _referralSettings.value
        var fetchedUser = _user.value
        var hadSuccessfulFetch = false

        try {
            coroutineScope {
                val userDef = async { runCatching { api.getCurrentUser() } }
                val modesDef = async { runCatching { api.getGameModes(null) } }
                val announcementDef = async { runCatching { api.getAnnouncement() } }
                val bannersDef = async { runCatching { api.getBanners() } }
                val leaderboardDef = async { runCatching { api.getLeaderboard() } }
                val supportDef = async { runCatching { fetchSupportUrlFromApi() } }
                val referralDef = async { runCatching { api.getReferralSettings() } }

                userDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { user ->
                    if (user != fetchedUser) {
                        _user.value = user
                    }
                    fetchedUser = user
                    hadSuccessfulFetch = true
                }

                modesDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { modes ->
                    if (HomeCacheStore.modesFingerprint(modes) != HomeCacheStore.modesFingerprint(_modes.value)) {
                        _modes.value = modes
                    }
                    fetchedModes = modes
                    hadSuccessfulFetch = true
                }

                announcementDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { body ->
                    val text = body["announcementText"]?.trim().orEmpty()
                    if (text.isNotBlank() && text != _announcementText.value) {
                        _announcementText.value = text
                    }
                    if (text.isNotBlank()) {
                        fetchedAnnouncement = text
                        hadSuccessfulFetch = true
                    }
                }

                bannersDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { banners ->
                    val previousKey = HomeCacheStore.bannersFingerprint(_banners.value)
                    val newKey = HomeCacheStore.bannersFingerprint(banners)
                    if (newKey != previousKey) {
                        if (force || bannerImagesChanged(_banners.value, banners)) {
                            _contentRefreshEpoch.value = HomeCacheStore.imageCacheEpoch(
                                banners,
                                _referralSettings.value,
                            )
                        }
                        _banners.value = banners
                    }
                    fetchedBanners = banners
                    hadSuccessfulFetch = true
                }

                leaderboardDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { board ->
                    if (board != _leaderboard.value) {
                        _leaderboard.value = board
                    }
                    hadSuccessfulFetch = true
                }

                supportDef.await().getOrNull()?.let { url ->
                    if (url != _supportUrl.value) {
                        _supportUrl.value = url
                    }
                    hadSuccessfulFetch = true
                }

                referralDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { referral ->
                    val previousKey = HomeCacheStore.referralFingerprint(_referralSettings.value)
                    val newKey = HomeCacheStore.referralFingerprint(referral)
                    if (newKey != previousKey) {
                        if (force || _referralSettings.value?.bannerUrl != referral.bannerUrl) {
                            _contentRefreshEpoch.value = HomeCacheStore.imageCacheEpoch(
                                _banners.value,
                                referral,
                            )
                        }
                        _referralSettings.value = referral
                    }
                    fetchedReferral = referral
                    hadSuccessfulFetch = true
                }
            }

            if (hadSuccessfulFetch) {
                homeCacheStore.saveHomeContent(
                    modes = fetchedModes,
                    banners = fetchedBanners,
                    announcementText = fetchedAnnouncement,
                    referralSettings = fetchedReferral,
                    user = fetchedUser,
                    imageCacheEpoch = _contentRefreshEpoch.value,
                )
                _hasCachedHomeContent.value = true
            } else if (!_hasCachedHomeContent.value) {
                _errorMessage.value = "Unable to reach the server. Check your connection and try again."
            }
        } catch (e: Exception) {
            if (!_hasCachedHomeContent.value) {
                _errorMessage.value = "Network error: ${e.localizedMessage}"
            }
            e.printStackTrace()
        }
    }

    private fun applyCacheFromStore() {
        var applied = false

        homeCacheStore.getCachedModes()?.takeIf { it.isNotEmpty() }?.let {
            _modes.value = it
            applied = true
        }
        homeCacheStore.getCachedBanners()?.takeIf { it.isNotEmpty() }?.let {
            _banners.value = it
            applied = true
        }
        homeCacheStore.getCachedAnnouncement()?.let {
            _announcementText.value = it
            applied = true
        }
        homeCacheStore.getCachedReferralSettings()?.let {
            _referralSettings.value = it
            applied = true
        }
        homeCacheStore.getCachedUser()?.let {
            _user.value = it
        }

        val cachedBanners = homeCacheStore.getCachedBanners().orEmpty()
        val cachedReferral = homeCacheStore.getCachedReferralSettings()
        val storedEpoch = homeCacheStore.getImageCacheEpoch()
        _contentRefreshEpoch.value = when {
            storedEpoch != 0L -> storedEpoch
            cachedBanners.isNotEmpty() || cachedReferral != null ->
                HomeCacheStore.imageCacheEpoch(cachedBanners, cachedReferral)
            else -> 0L
        }

        _hasCachedHomeContent.value = applied || homeCacheStore.hasCachedPlayOrEarnContent()
    }

    private fun bannerImagesChanged(old: List<AppBanner>, new: List<AppBanner>): Boolean {
        val oldImages = old.associate { it.id to it.imageUrl }
        val newImages = new.associate { it.id to it.imageUrl }
        return oldImages != newImages
    }

    @OptIn(ExperimentalCoilApi::class)
    private fun clearImageCaches() {
        runCatching {
            val loader = Coil.imageLoader(context)
            loader.memoryCache?.clear()
            loader.diskCache?.clear()
        }
    }

    fun refreshSupportUrl() {
        viewModelScope.launch {
            fetchSupportUrlFromApi()?.let { _supportUrl.value = it }
        }
    }

    fun openCustomerSupport(context: Context) {
        viewModelScope.launch {
            val fetched = fetchSupportUrlFromApi()
            val raw = fetched?.takeIf { it.isNotBlank() } ?: _supportUrl.value.takeIf { it.isNotBlank() }
            val url = normalizeSupportUrl(raw)

            if (url.isNullOrBlank()) {
                Toast.makeText(context, "Support link not configured yet", Toast.LENGTH_SHORT).show()
                return@launch
            }

            if (fetched != null) {
                _supportUrl.value = fetched
            }

            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (e: Exception) {
                Toast.makeText(context, "Could not open support link", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private suspend fun fetchSupportUrlFromApi(): String? {
        val supRes = api.getCustomerSupportUrl()
        if (!supRes.isSuccessful) return null
        return normalizeSupportUrl(supRes.body()?.resolvedUrl())
    }

    private fun normalizeSupportUrl(raw: String?): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return null
        return if (
            trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            trimmed
        } else {
            "https://$trimmed"
        }
    }
}
