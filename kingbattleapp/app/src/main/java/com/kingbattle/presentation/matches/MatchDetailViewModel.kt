package com.kingbattle.presentation.matches

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.JoinMatchRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.local.TokenManager
import com.kingbattle.domain.model.Match
import com.kingbattle.domain.model.MatchDetail
import com.kingbattle.domain.model.Participant
import com.kingbattle.domain.model.PrizePool
import com.kingbattle.domain.model.RankReward
import com.kingbattle.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MatchDetailViewModel @Inject constructor(
    private val api: KingBattleApi,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _matchDetail = MutableStateFlow<MatchDetail?>(null)
    val matchDetail: StateFlow<MatchDetail?> = _matchDetail.asStateFlow()

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun loadData(matchId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                // 1. Load current user profile (for balance)
                try {
                    val userRes = api.getCurrentUser()
                    if (userRes.isSuccessful && userRes.body() != null) {
                        _user.value = userRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // 2. Fetch match detail from backend API
                try {
                    val detailRes = api.getMatchDetail(matchId)
                    if (detailRes.isSuccessful && detailRes.body() != null) {
                        _matchDetail.value = detailRes.body()!!
                    } else {
                        _matchDetail.value = null
                        _errorMessage.value = "Failed to fetch match details"
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    _matchDetail.value = null
                    _errorMessage.value = "Failed to load match: ${e.localizedMessage}"
                }

            } catch (e: Exception) {
                _errorMessage.value = "Failed to load match: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun joinMatch(
        matchId: String,
        inGameName: String,
        inGameUid: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val response = api.joinMatch(
                    matchId = matchId,
                    request = JoinMatchRequest(
                        in_game_name = inGameName,
                        in_game_uid = inGameUid
                    )
                )
                if (response.isSuccessful) {
                    tokenManager.saveJoinedMatch(matchId)
                    // Reload data to show updated state
                    loadData(matchId)
                    onSuccess()
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Failed to join match"
                    onError(errorBody)
                }
            } catch (e: Exception) {
                onError(e.localizedMessage ?: "Network error")
            }
        }
    }
}
