package com.kingbattle.presentation.matches

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.JoinMatchRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.api.TeamMember
import com.kingbattle.data.local.TokenManager
import com.kingbattle.domain.model.Match
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
class MatchesViewModel @Inject constructor(
    private val api: KingBattleApi,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _matches = MutableStateFlow<List<Match>>(emptyList())
    val matches: StateFlow<List<Match>> = _matches.asStateFlow()

    private val _modeName = MutableStateFlow("SOLO MATCHES")
    val modeName: StateFlow<String> = _modeName.asStateFlow()

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Joined match IDs — read from TokenManager (EncryptedSharedPreferences)
    private val _joinedMatches = MutableStateFlow<Set<String>>(emptySet())
    val joinedMatches: StateFlow<Set<String>> = _joinedMatches.asStateFlow()

    init {
        _joinedMatches.value = tokenManager.getJoinedMatches()
    }

    fun loadData(modeId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                // 1. Fetch user data to check balance
                try {
                    val userRes = api.getCurrentUser()
                    if (userRes.isSuccessful && userRes.body() != null) {
                        _user.value = userRes.body()!!
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                val currentUserId = _user.value?.id

                if (modeId == "my_matches") {
                    _modeName.value = "MY MATCHES"

                    val loadedMatches = mutableListOf<Match>()

                    // 1. Fetch modes first to get their actual IDs from server
                    var serverModes = emptyList<com.kingbattle.domain.model.GameMode>()
                    try {
                        val modesRes = api.getGameModes(null)
                        if (modesRes.isSuccessful && modesRes.body() != null) {
                            serverModes = modesRes.body()!!
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }

                    if (serverModes.isNotEmpty()) {
                        // 2. Fetch matches for each mode
                        for (mode in serverModes) {
                            try {
                                val res = api.getMatches(mode.id)
                                if (res.isSuccessful && res.body() != null) {
                                    loadedMatches.addAll(res.body()!!)
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }

                    // Get user transactions to find match IDs joined on server
                    val serverJoinedMatchIds = mutableSetOf<String>()
                    if (currentUserId != null) {
                        try {
                            val txRes = api.getUserTransactions(currentUserId)
                            if (txRes.isSuccessful && txRes.body() != null) {
                                val joinedIds = txRes.body()!!
                                    .filter { it.type == "match_entry" && it.reference_id != null }
                                    .map { it.reference_id!! }
                                serverJoinedMatchIds.addAll(joinedIds)
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    // Get locally joined match IDs
                    val localJoinedMatchIds = tokenManager.getJoinedMatches()
                    val joinedMatchIds = serverJoinedMatchIds + localJoinedMatchIds

                    val filtered = loadedMatches.filter { match ->
                        joinedMatchIds.contains(match.id)
                    }

                    _matches.value = filtered

                } else {
                    // Dynamic modeName resolution
                    val isSolo = modeId.contains("solo", ignoreCase = true)
                    val isDuo = modeId.contains("duo", ignoreCase = true)
                    val isSquad = modeId.contains("squad", ignoreCase = true)
                    _modeName.value = when {
                        isSolo -> "SOLO MATCHES"
                        isDuo -> "DUO MATCHES"
                        isSquad -> "SQUAD MATCHES"
                        else -> "MATCHES"
                    }

                    try {
                        val modesRes = api.getGameModes(null)
                        if (modesRes.isSuccessful && modesRes.body() != null) {
                            val matchingMode = modesRes.body()?.find { it.id == modeId }
                            if (matchingMode != null) {
                                _modeName.value = matchingMode.name.uppercase() + " MATCHES"
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }

                    // 2. Fetch matches for modeId
                    try {
                        val response = api.getMatches(modeId)
                        if (response.isSuccessful && response.body() != null) {
                            _matches.value = response.body()!!
                        } else {
                            _matches.value = emptyList()
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        _matches.value = emptyList()
                    }
                }

            } catch (e: Exception) {
                _errorMessage.value = "Failed to load matches: ${e.localizedMessage}"
                _matches.value = emptyList()
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
                    _joinedMatches.value = _joinedMatches.value + matchId
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
