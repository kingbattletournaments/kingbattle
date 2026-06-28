package com.kingbattle.presentation.matches

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.JoinMatchRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.local.HomeCacheStore
import com.kingbattle.data.local.TokenManager
import com.kingbattle.domain.model.Match
import com.kingbattle.domain.model.PrizePool
import com.kingbattle.domain.model.RankReward
import com.kingbattle.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MatchesViewModel @Inject constructor(
    private val api: KingBattleApi,
    private val tokenManager: TokenManager,
    private val homeCacheStore: HomeCacheStore,
) : ViewModel() {

    private val _matches = MutableStateFlow<List<Match>>(emptyList())
    val matches: StateFlow<List<Match>> = _matches.asStateFlow()

    private val _modeName = MutableStateFlow("SOLO MATCHES")
    val modeName: StateFlow<String> = _modeName.asStateFlow()

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _joinedMatches = MutableStateFlow<Set<String>>(emptySet())
    val joinedMatches: StateFlow<Set<String>> = _joinedMatches.asStateFlow()

    init {
        syncJoinedMatches()
    }

    fun syncJoinedMatches() {
        _joinedMatches.value = tokenManager.getJoinedMatches()
    }

    /** Apply optimistic slot count + refresh list after a join completed elsewhere in the app. */
    fun onExternalJoinCompleted(modeId: String) {
        val pending = MatchJoinNotifier.consumePending()
        syncJoinedMatches()
        if (pending != null) {
            val (matchId, slotsBooked) = pending
            _matches.value = _matches.value.map { m ->
                if (m.id == matchId) {
                    val effective = MatchJoinNotifier.applyServerCount(
                        matchId,
                        (m.participant_count ?: 0) + slotsBooked,
                    )
                    m.copy(participant_count = effective)
                } else m
            }
            SelectedMatchHolder.selectedMatch?.let { selected ->
                if (selected.id == matchId) {
                    val effective = MatchJoinNotifier.applyServerCount(
                        matchId,
                        (selected.participant_count ?: 0) + slotsBooked,
                    )
                    SelectedMatchHolder.selectedMatch = selected.copy(participant_count = effective)
                }
            }
        }
        refreshData(modeId)
    }

    private fun mergeParticipantCounts(serverMatches: List<Match>): List<Match> =
        serverMatches.map { m ->
            m.copy(participant_count = MatchJoinNotifier.applyServerCount(m.id, m.participant_count))
        }

    fun refreshData(modeId: String) {
        loadData(modeId, force = true)
    }

    fun loadData(modeId: String, force: Boolean = false) {
        viewModelScope.launch {
            if (!force && _matches.value.isEmpty()) {
                _isLoading.value = true
            } else if (force) {
                _isRefreshing.value = true
            }
            _errorMessage.value = null
            try {
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

                    val serverModes = resolveModesFromCacheOrNetwork()
                    val loadedMatches = if (serverModes.isNotEmpty()) {
                        coroutineScope {
                            serverModes.map { mode ->
                                async {
                                    runCatching { api.getMatches(mode.id) }
                                        .getOrNull()
                                        ?.takeIf { it.isSuccessful }
                                        ?.body()
                                        .orEmpty()
                                }
                            }.awaitAll().flatten()
                        }
                    } else {
                        emptyList()
                    }

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

                    val localJoinedMatchIds = tokenManager.getJoinedMatches()
                    val joinedMatchIds = serverJoinedMatchIds + localJoinedMatchIds

                    _matches.value = loadedMatches.filter { joinedMatchIds.contains(it.id) }
                        .let { mergeParticipantCounts(it) }
                } else {
                    val isSolo = modeId.contains("solo", ignoreCase = true)
                    val isDuo = modeId.contains("duo", ignoreCase = true)
                    val isSquad = modeId.contains("squad", ignoreCase = true)
                    _modeName.value = when {
                        isSolo -> "SOLO MATCHES"
                        isDuo -> "DUO MATCHES"
                        isSquad -> "SQUAD MATCHES"
                        else -> "MATCHES"
                    }

                    resolveModesFromCacheOrNetwork()
                        .find { it.id == modeId }
                        ?.let { _modeName.value = it.name.uppercase() + " MATCHES" }

                    try {
                        val response = api.getMatches(modeId)
                        if (response.isSuccessful && response.body() != null) {
                            _matches.value = mergeParticipantCounts(response.body()!!)
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
                _isRefreshing.value = false
            }
        }
    }

    private suspend fun resolveModesFromCacheOrNetwork(): List<com.kingbattle.domain.model.GameMode> {
        homeCacheStore.getCachedModes()?.takeIf { it.isNotEmpty() }?.let { return it }
        return try {
            val modesRes = api.getGameModes(null)
            if (modesRes.isSuccessful && modesRes.body() != null) {
                modesRes.body()!!
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    fun joinMatch(
        matchId: String,
        inGameName: String,
        inGameUid: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val response = api.joinMatch(
                    matchId = matchId,
                    request = JoinMatchRequest(
                        in_game_name = inGameName,
                        in_game_uid = inGameUid,
                    ),
                )
                if (response.isSuccessful) {
                    tokenManager.saveJoinedMatch(matchId)
                    _joinedMatches.value = _joinedMatches.value + matchId
                    val participantCount = response.body()?.participantCount
                    MatchJoinNotifier.notifyJoined(matchId, 1, participantCount)
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
