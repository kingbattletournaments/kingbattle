package com.kingbattle.presentation.home

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.local.HomeCacheStore
import com.kingbattle.domain.model.GameMode
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

    private val _banners = MutableStateFlow<List<com.kingbattle.domain.model.AppBanner>>(emptyList())
    val banners: StateFlow<List<com.kingbattle.domain.model.AppBanner>> = _banners.asStateFlow()

    private val _leaderboard = MutableStateFlow<List<com.kingbattle.domain.model.LeaderboardUser>>(emptyList())
    val leaderboard: StateFlow<List<com.kingbattle.domain.model.LeaderboardUser>> = _leaderboard.asStateFlow()

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _supportUrl = MutableStateFlow("")
    val supportUrl: StateFlow<String> = _supportUrl.asStateFlow()

    private val _referralSettings = MutableStateFlow<com.kingbattle.domain.model.ReferralSettings?>(null)
    val referralSettings: StateFlow<com.kingbattle.domain.model.ReferralSettings?> = _referralSettings.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        applyCacheFromStore()
        loadData(force = false)
    }

    fun loadData(force: Boolean = false) {
        viewModelScope.launch {
            if (!force && homeCacheStore.hasCachedContent() && homeCacheStore.isContentFresh()) {
                refreshDynamicContent(showLoading = false)
                return@launch
            }

            val showBlockingLoader = _modes.value.isEmpty() && _banners.value.isEmpty()
            if (showBlockingLoader) {
                _isLoading.value = true
            } else {
                _isRefreshing.value = true
            }
            _errorMessage.value = null

            if (!NetworkUtils.isOnline(context)) {
                _isOffline.value = true
                if (!homeCacheStore.hasCachedContent()) {
                    _errorMessage.value =
                        "No internet connection. Connect to load live tournaments and wallet data."
                }
                _isLoading.value = false
                _isRefreshing.value = false
                return@launch
            }

            _isOffline.value = false
            fetchFromNetwork()
            _isLoading.value = false
            _isRefreshing.value = false
        }
    }

    private suspend fun refreshDynamicContent(showLoading: Boolean) {
        if (showLoading) _isRefreshing.value = true
        if (!NetworkUtils.isOnline(context)) {
            _isOffline.value = true
            _isRefreshing.value = false
            return
        }
        _isOffline.value = false
        try {
            coroutineScope {
                val userDef = async { runCatching { api.getCurrentUser() } }
                val leaderboardDef = async { runCatching { api.getLeaderboard() } }
                val supportDef = async { runCatching { fetchSupportUrlFromApi() } }

                userDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    _user.value = it
                }
                leaderboardDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    _leaderboard.value = it
                }
                supportDef.await().getOrNull()?.let { _supportUrl.value = it }
            }
        } finally {
            _isRefreshing.value = false
        }
    }

    private suspend fun fetchFromNetwork() {
        var fetchedModes = _modes.value
        var fetchedBanners = _banners.value
        var fetchedAnnouncement = _announcementText.value
        var fetchedReferral = _referralSettings.value
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

                userDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    _user.value = it
                    hadSuccessfulFetch = true
                }

                modesDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    fetchedModes = it
                    _modes.value = it
                    hadSuccessfulFetch = true
                }

                announcementDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let { body ->
                    body["announcementText"]?.takeIf { it.isNotBlank() }?.let {
                        fetchedAnnouncement = it
                        _announcementText.value = it
                        hadSuccessfulFetch = true
                    }
                }

                bannersDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    fetchedBanners = it
                    _banners.value = it
                    hadSuccessfulFetch = true
                }

                leaderboardDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    _leaderboard.value = it
                    hadSuccessfulFetch = true
                }

                supportDef.await().getOrNull()?.let {
                    _supportUrl.value = it
                    hadSuccessfulFetch = true
                }

                referralDef.await().getOrNull()?.takeIf { it.isSuccessful }?.body()?.let {
                    fetchedReferral = it
                    _referralSettings.value = it
                    hadSuccessfulFetch = true
                }
            }

            if (hadSuccessfulFetch) {
                homeCacheStore.saveHomeContent(
                    modes = fetchedModes,
                    banners = fetchedBanners,
                    announcementText = fetchedAnnouncement,
                    referralSettings = fetchedReferral,
                )
            } else if (!homeCacheStore.hasCachedContent()) {
                _errorMessage.value = "Unable to reach the server. Check your connection and try again."
            }
        } catch (e: Exception) {
            if (!homeCacheStore.hasCachedContent()) {
                _errorMessage.value = "Network error: ${e.localizedMessage}"
            }
            e.printStackTrace()
        }
    }

    private fun applyCacheFromStore() {
        homeCacheStore.getCachedModes()?.let { _modes.value = it }
        homeCacheStore.getCachedBanners()?.let { _banners.value = it }
        homeCacheStore.getCachedAnnouncement()?.let { _announcementText.value = it }
        homeCacheStore.getCachedReferralSettings()?.let { _referralSettings.value = it }
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
