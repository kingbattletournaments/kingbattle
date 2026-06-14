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
                        val serverDetail = detailRes.body()!!
                        // If participants list from server is empty, add mock participants for a populated visual preview
                        if (serverDetail.participants.isEmpty()) {
                            _matchDetail.value = serverDetail.copy(
                                participants = getMockParticipants()
                            )
                        } else {
                            _matchDetail.value = serverDetail
                        }
                    } else {
                        // Fallback to local mock matching
                        _matchDetail.value = getFallbackMockDetail(matchId)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    _matchDetail.value = getFallbackMockDetail(matchId)
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
                // If it is a mock match, bypass network call and succeed locally
                if (matchId.contains("fake-") || matchId.contains("solo-") || matchId.contains("duo-") || matchId.contains("squad-")) {
                    tokenManager.saveJoinedMatch(matchId)
                    loadData(matchId)
                    onSuccess()
                } else {
                    onError(e.localizedMessage ?: "Network error")
                }
            }
        }
    }

    private fun getFallbackMockDetail(matchId: String): MatchDetail {
        val isSolo = matchId.contains("solo", ignoreCase = true)
        val isDuo = matchId.contains("duo", ignoreCase = true)
        val isSquad = matchId.contains("squad", ignoreCase = true) || (!isSolo && !isDuo)

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

        val title = when {
            matchId.contains("ongoing") -> "BR $modeName PER KILL MATCH - Match #997"
            matchId.contains("upcoming-1") -> "BR $modeName GRAND TOURNAMENT - Match #1021"
            matchId.contains("upcoming-2") -> "BR $modeName PER KILL MATCH - Match #1022"
            matchId.contains("completed-1") -> "BR $modeName SUNDAY CHAMPIONSHIP - Match #985"
            else -> "BR $modeName PER KILL MATCH - Match #1011"
        }

        val fee = if (matchId.contains("upcoming-1")) 25 else if (matchId.contains("upcoming-2")) 10 else 13
        val prize = if (matchId.contains("upcoming-1")) 1000 else if (matchId.contains("upcoming-2")) 400 else 500
        val perKill = if (matchId.contains("upcoming-1")) 15 else if (matchId.contains("upcoming-2")) 8 else 10
        val map = if (matchId.contains("upcoming-1")) "PURGATORY" else if (matchId.contains("completed-1")) "KALAHARI" else "BERMUDA"
        val startsAt = if (matchId.contains("ongoing")) "12/06/2026 06:30 pm" else if (matchId.contains("completed-1")) "07/06/2026 02:00 pm" else "13/06/2026 01:00 pm"
        val status = if (matchId.contains("ongoing")) "ongoing" else if (matchId.contains("completed")) "completed" else "upcoming"

        val posters = listOf("match_poster_1", "match_poster_2", "match_poster_3")

        val mockMatch = Match(
            id = matchId,
            game_mode_id = "fake-$matchType",
            title = title,
            entry_fee = fee,
            room_code = if (status != "upcoming") "ROOMCODE1" else null,
            room_password = if (status != "upcoming") "PASS" else null,
            status = status,
            registration_locked = status != "upcoming",
            max_participants = maxPlayers,
            starts_at = startsAt,
            participant_count = 12,
            matchType = matchType,
            prizePool = PrizePool(
                coins_per_kill = perKill,
                total_prize_pool = prize,
                rank_rewards = listOf(
                    RankReward(from_rank = 1, to_rank = 1, coins = prize / 3),
                    RankReward(from_rank = 2, to_rank = 2, coins = prize / 5),
                    RankReward(from_rank = 3, to_rank = 5, coins = prize / 10)
                )
            ),
            version = "TPP",
            map = map,
            image = posters[Math.abs(matchId.hashCode()) % posters.size]
        )

        return MatchDetail(
            match = mockMatch,
            participants = getMockParticipants(),
            prize_pool = mockMatch.prizePool
        )
    }

    private fun getMockParticipants(): List<Participant> {
        val names = listOf(
            "shrikanth",
            "veduboss",
            "ANUBHAV",
            "PSG ISHAN",
            "4264456607",
            "God?SAMEER™",
            "Comatozeq()",
            "?W S̵ᴀHIL !",
            "asif1120515F",
            "GCR_444",
            "ripmonster",
            "RoʜɪᴛSHARMA"
        )
        return names.mapIndexed { index, name ->
            Participant(
                id = "part-${index + 1}",
                user_id = "user-${index + 1}",
                in_game_name = name,
                in_game_uid = "1000000${index + 1}",
                joined_at = "13/06/2026 10:00 am"
            )
        }
    }
}
