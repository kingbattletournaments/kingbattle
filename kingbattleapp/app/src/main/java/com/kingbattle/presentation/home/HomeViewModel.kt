package com.kingbattle.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.domain.model.GameMode
import com.kingbattle.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val api: KingBattleApi
) : ViewModel() {

    private val _modes = MutableStateFlow<List<GameMode>>(
        listOf(
            GameMode(id = "fake-solo", game_id = "default-game-free-fire", name = "SOLO", image_url = null),
            GameMode(id = "fake-duo", game_id = "default-game-free-fire", name = "DUO", image_url = null),
            GameMode(id = "fake-squad", game_id = "default-game-free-fire", name = "SQUAD", image_url = null)
        )
    )
    val modes: StateFlow<List<GameMode>> = _modes.asStateFlow()

    private val _announcementText = MutableStateFlow("🔥 Welcome to King Battle! Join daily Free Fire tournaments and win real coins! Fast withdrawals guaranteed! 🔥")
    val announcementText: StateFlow<String> = _announcementText.asStateFlow()

    private val _banners = MutableStateFlow<List<com.kingbattle.domain.model.AppBanner>>(emptyList())
    val banners: StateFlow<List<com.kingbattle.domain.model.AppBanner>> = _banners.asStateFlow()

    private val _leaderboard = MutableStateFlow<List<com.kingbattle.domain.model.LeaderboardUser>>(
        listOf(
            com.kingbattle.domain.model.LeaderboardUser(id = "1", displayName = "Eiden", coins = 2430),
            com.kingbattle.domain.model.LeaderboardUser(id = "2", displayName = "Jackson", coins = 1847),
            com.kingbattle.domain.model.LeaderboardUser(id = "3", displayName = "Emma Aria", coins = 1674),
            com.kingbattle.domain.model.LeaderboardUser(id = "4", displayName = "Sebastian", coins = 1124),
            com.kingbattle.domain.model.LeaderboardUser(id = "5", displayName = "Jason", coins = 875),
            com.kingbattle.domain.model.LeaderboardUser(id = "6", displayName = "Natalie", coins = 774),
            com.kingbattle.domain.model.LeaderboardUser(id = "7", displayName = "Serenity", coins = 723),
            com.kingbattle.domain.model.LeaderboardUser(id = "8", displayName = "Hannah", coins = 559),
            com.kingbattle.domain.model.LeaderboardUser(id = "9", displayName = "Tyler", coins = 450),
            com.kingbattle.domain.model.LeaderboardUser(id = "10", displayName = "Sophia", coins = 380)
        )
    )
    val leaderboard: StateFlow<List<com.kingbattle.domain.model.LeaderboardUser>> = _leaderboard.asStateFlow()

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _supportUrl = MutableStateFlow("")
    val supportUrl: StateFlow<String> = _supportUrl.asStateFlow()

    private val _referralSettings = MutableStateFlow<com.kingbattle.domain.model.ReferralSettings?>(null)
    val referralSettings: StateFlow<com.kingbattle.domain.model.ReferralSettings?> = _referralSettings.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                // Fetch user info
                try {
                    val userRes = api.getCurrentUser()
                    if (userRes.isSuccessful && userRes.body() != null) {
                        _user.value = userRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Fetch modes - fall back to fake modes if server is down or empty
                try {
                    val response = api.getGameModes(null)
                    if (response.isSuccessful && response.body() != null && response.body()!!.isNotEmpty()) {
                        _modes.value = response.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Fetch announcement text
                try {
                    val annRes = api.getAnnouncement()
                    if (annRes.isSuccessful && annRes.body() != null) {
                        val text = annRes.body()!!["announcementText"]
                        if (!text.isNullOrBlank()) {
                            _announcementText.value = text
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Fetch banners list
                try {
                    val banRes = api.getBanners()
                    if (banRes.isSuccessful && banRes.body() != null) {
                        _banners.value = banRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Fetch leaderboard
                try {
                    val leadRes = api.getLeaderboard()
                    if (leadRes.isSuccessful && leadRes.body() != null) {
                        _leaderboard.value = leadRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Fetch customer support URL
                try {
                    val supRes = api.getCustomerSupportUrl()
                    if (supRes.isSuccessful && supRes.body() != null) {
                        val url = supRes.body()!!["customerSupportUrl"] ?: supRes.body()!!["url"]
                        if (!url.isNullOrBlank()) {
                            _supportUrl.value = url
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Fetch referral settings
                try {
                    val refRes = api.getReferralSettings()
                    if (refRes.isSuccessful && refRes.body() != null) {
                        _referralSettings.value = refRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

            } catch (e: Exception) {
                _errorMessage.value = "Network error: ${e.localizedMessage}"
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }
}
