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

                    val allModes = listOf("fake-solo", "fake-duo", "fake-squad")
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

                    val modeIdsToQuery = if (serverModes.isNotEmpty()) {
                        serverModes.map { it.id }
                    } else {
                        allModes
                    }

                    // 2. Fetch matches for each mode
                    for (mId in modeIdsToQuery) {
                        try {
                            val res = api.getMatches(mId)
                            if (res.isSuccessful && res.body() != null) {
                                loadedMatches.addAll(res.body()!!)
                            } else {
                                loadedMatches.addAll(getMockMatches(mId))
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            loadedMatches.addAll(getMockMatches(mId))
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

                    if (filtered.isEmpty()) {
                        // Pre-populate with a couple of mock matches marked as joined for preview
                        val defaultJoinedMockMatches = getMockMatches("fake-solo").take(1) + getMockMatches("fake-duo").take(1)
                        for (m in defaultJoinedMockMatches) {
                            tokenManager.saveJoinedMatch(m.id)
                        }
                        _matches.value = defaultJoinedMockMatches
                    } else {
                        _matches.value = filtered
                    }

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
                            val serverMatches = response.body()!!
                            _matches.value = serverMatches + getMockMatches(modeId)
                        } else {
                            _matches.value = getMockMatches(modeId)
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        _matches.value = getMockMatches(modeId)
                    }
                }

            } catch (e: Exception) {
                _errorMessage.value = "Failed to load matches: ${e.localizedMessage}"
                _matches.value = getMockMatches(modeId)
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
                    onSuccess()
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Failed to join match"
                    onError(errorBody)
                }
            } catch (e: Exception) {
                if (matchId.contains("fake-") || matchId.contains("solo-") || matchId.contains("duo-") || matchId.contains("squad-")) {
                    tokenManager.saveJoinedMatch(matchId)
                    onSuccess()
                } else {
                    onError(e.localizedMessage ?: "Network error")
                }
            }
        }
    }

    private fun getMockMatches(modeId: String): List<Match> {
        val isSolo = modeId.contains("solo", ignoreCase = true)
        val isDuo = modeId.contains("duo", ignoreCase = true)
        val isSquad = modeId.contains("squad", ignoreCase = true) || (!isSolo && !isDuo)

        val modeName = when {
            isSolo -> "SOLO"
            isDuo -> "DUO"
            else -> "SQUAD"
        }

        val matchType = when {
            isSolo -> "solo"
            isDuo -> "duo"
            else -> "squad"
        }

        val maxPlayers = when {
            isSolo -> 100
            isDuo -> 48
            else -> 48
        }

        val posters = listOf("match_poster_1", "match_poster_2", "match_poster_3")

        return listOf(
            // 1. Ongoing Match
            Match(
                id = "${modeId}-ongoing-1",
                game_mode_id = modeId,
                title = "BR $modeName PER KILL MATCH - Match #997",
                entry_fee = 13,
                room_code = "ROOM123",
                room_password = "PASS",
                status = "ongoing",
                registration_locked = true,
                max_participants = maxPlayers,
                starts_at = "12/06/2026 06:30 pm",
                participant_count = maxPlayers - 10,
                matchType = matchType,
                prizePool = PrizePool(
                    coins_per_kill = 10,
                    total_prize_pool = 500,
                    rank_rewards = listOf(
                        RankReward(from_rank = 1, to_rank = 1, coins = 150),
                        RankReward(from_rank = 2, to_rank = 2, coins = 100),
                        RankReward(from_rank = 3, to_rank = 5, coins = 50)
                    )
                ),
                version = "TPP",
                map = "BERMUDA",
                image = posters[Math.abs("${modeId}-ongoing-1".hashCode()) % posters.size]
            ),
            // 2. Upcoming Match 1
            Match(
                id = "${modeId}-upcoming-1",
                game_mode_id = modeId,
                title = "BR $modeName GRAND TOURNAMENT - Match #1021",
                entry_fee = 25,
                room_code = null,
                room_password = null,
                status = "upcoming",
                registration_locked = false,
                max_participants = maxPlayers,
                starts_at = "13/06/2026 04:00 pm",
                participant_count = 15,
                matchType = matchType,
                prizePool = PrizePool(
                    coins_per_kill = 15,
                    total_prize_pool = 1000,
                    rank_rewards = listOf(
                        RankReward(from_rank = 1, to_rank = 1, coins = 300),
                        RankReward(from_rank = 2, to_rank = 2, coins = 200),
                        RankReward(from_rank = 3, to_rank = 10, coins = 50)
                    )
                ),
                version = "TPP",
                map = "PURGATORY",
                image = posters[Math.abs("${modeId}-upcoming-1".hashCode()) % posters.size]
            ),
            // 3. Upcoming Match 2
            Match(
                id = "${modeId}-upcoming-2",
                game_mode_id = modeId,
                title = "BR $modeName PER KILL MATCH - Match #1022",
                entry_fee = 10,
                room_code = null,
                room_password = null,
                status = "upcoming",
                registration_locked = false,
                max_participants = maxPlayers,
                starts_at = "13/06/2026 08:30 pm",
                participant_count = 31,
                matchType = matchType,
                prizePool = PrizePool(
                    coins_per_kill = 8,
                    total_prize_pool = 400,
                    rank_rewards = listOf(
                        RankReward(from_rank = 1, to_rank = 1, coins = 100),
                        RankReward(from_rank = 2, to_rank = 2, coins = 60),
                        RankReward(from_rank = 3, to_rank = 5, coins = 30)
                    )
                ),
                version = "TPP",
                map = "BERMUDA",
                image = posters[Math.abs("${modeId}-upcoming-2".hashCode()) % posters.size]
            ),
            // 4. Completed Match 1 (Results)
            Match(
                id = "${modeId}-completed-1",
                game_mode_id = modeId,
                title = "BR $modeName SUNDAY CHAMPIONSHIP - Match #985",
                entry_fee = 20,
                room_code = "ROOM985",
                room_password = "PASS",
                status = "completed",
                registration_locked = true,
                max_participants = maxPlayers,
                starts_at = "07/06/2026 02:00 pm",
                participant_count = maxPlayers,
                matchType = matchType,
                prizePool = PrizePool(
                    coins_per_kill = 12,
                    total_prize_pool = 800,
                    rank_rewards = listOf(
                        RankReward(from_rank = 1, to_rank = 1, coins = 200),
                        RankReward(from_rank = 2, to_rank = 2, coins = 120),
                        RankReward(from_rank = 3, to_rank = 5, coins = 60)
                    )
                ),
                version = "TPP",
                map = "KALAHARI",
                image = posters[Math.abs("${modeId}-completed-1".hashCode()) % posters.size]
            ),
            // 5. Completed Match 2 (Results)
            Match(
                id = "${modeId}-completed-2",
                game_mode_id = modeId,
                title = "BR $modeName PER KILL MATCH - Match #986",
                entry_fee = 13,
                room_code = "ROOM986",
                room_password = "PASS",
                status = "completed",
                registration_locked = true,
                max_participants = maxPlayers,
                starts_at = "07/06/2026 07:00 pm",
                participant_count = maxPlayers,
                matchType = matchType,
                prizePool = PrizePool(
                    coins_per_kill = 10,
                    total_prize_pool = 500,
                    rank_rewards = listOf(
                        RankReward(from_rank = 1, to_rank = 1, coins = 150),
                        RankReward(from_rank = 2, to_rank = 2, coins = 100),
                        RankReward(from_rank = 3, to_rank = 5, coins = 50)
                    )
                ),
                version = "TPP",
                map = "BERMUDA",
                image = posters[Math.abs("${modeId}-completed-2".hashCode()) % posters.size]
            )
        )
    }
}
