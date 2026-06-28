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

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Joined match IDs — read from TokenManager (EncryptedSharedPreferences)
    private val _joinedMatches = MutableStateFlow<Set<String>>(emptySet())
    val joinedMatches: StateFlow<Set<String>> = _joinedMatches.asStateFlow()

    init {
        syncJoinedMatches()
    }

    fun syncJoinedMatches() {
        _joinedMatches.value = tokenManager.getJoinedMatches()
    }

    fun refreshMatchDetail(matchId: String) {
        viewModelScope.launch {
            _isRefreshing.value = true
            _errorMessage.value = null
            try {
                fetchUserProfile()
                fetchMatchDetail(matchId)
                fetchParticipants(matchId)
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun loadData(matchId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                fetchUserProfile()
                fetchMatchDetail(matchId)
            } catch (e: Exception) {
                _errorMessage.value = "Failed to load match: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Lightweight background fetch — only grabs user profile + participants
     * and merges them into the existing preloaded match data.
     * Never touches isLoading or errorMessage so the UI stays stable.
     */
    fun fetchExtras(matchId: String) {
        viewModelScope.launch {
            syncJoinedMatches()
            fetchUserProfile()
            fetchMatchDetail(matchId)
            fetchParticipants(matchId)
        }
    }

    private suspend fun fetchUserProfile() {
        try {
            val userRes = api.getCurrentUser()
            if (userRes.isSuccessful && userRes.body() != null) {
                _user.value = userRes.body()!!
            }
        } catch (_: Exception) {}
    }

    private suspend fun fetchMatchDetail(matchId: String) {
        try {
            val detailRes = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                api.getMatch(matchId)
            }
            if (detailRes != null && detailRes.isSuccessful && detailRes.body() != null) {
                val fresh = detailRes.body()!!
                val current = _matchDetail.value
                val count = MatchJoinNotifier.applyServerCount(matchId, fresh.participant_count)
                val matchWithCount = fresh.copy(participant_count = count)
                _matchDetail.value = if (current != null) {
                    current.copy(
                        match = matchWithCount,
                        prize_pool = fresh.prizePool ?: current.prize_pool,
                    )
                } else {
                    MatchDetail(matchWithCount, emptyList(), fresh.prizePool)
                }
                if (SelectedMatchHolder.selectedMatch?.id == matchId) {
                    SelectedMatchHolder.selectedMatch = matchWithCount
                }
            } else if (detailRes == null) {
                _errorMessage.value = "Match detail request timed out"
            } else if (_matchDetail.value == null) {
                _errorMessage.value = "Failed to fetch match details"
            }
        } catch (e: Exception) {
            if (_matchDetail.value == null) {
                _errorMessage.value = "Failed to load match: ${e.localizedMessage}"
            }
        }
    }

    private suspend fun fetchParticipants(matchId: String) {
        try {
            val participantsRes = kotlinx.coroutines.withTimeoutOrNull(5000L) {
                api.getMatchParticipants(matchId)
            }
            if (participantsRes != null && participantsRes.isSuccessful && participantsRes.body() != null) {
                val participants = participantsRes.body()!!
                val current = _matchDetail.value
                if (current != null) {
                    _matchDetail.value = current.copy(participants = participants)
                }
            }
        } catch (_: Exception) {}
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
                    val participantCount = response.body()?.participantCount
                    MatchJoinNotifier.notifyJoined(matchId, 1, participantCount)
                    fetchExtras(matchId)
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
    /**
     * Preload basic match information without network call.
     */
    fun preloadMatch(match: Match) {
        _matchDetail.value = MatchDetail(match, emptyList(), null)
        _isLoading.value = false
    }

    /**
     * Mark a match as joined — persists via TokenManager and updates reactive state.
     */
    fun markMatchJoined(matchId: String) {
        tokenManager.saveJoinedMatch(matchId)
        _joinedMatches.value = _joinedMatches.value + matchId
    }
}
