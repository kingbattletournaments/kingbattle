package com.kingbattle.presentation.matches

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.JoinMatchRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.local.TokenManager
import com.kingbattle.domain.model.Match
import com.kingbattle.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class MatchTab(val apiStatus: String) {
    ONGOING("ongoing"),
    UPCOMING("upcoming"),
    RESULTS("completed");

    companion object {
        fun fromPage(page: Int): MatchTab = entries[page.coerceIn(0, entries.lastIndex)]
    }
}

data class MatchTabState(
    val items: List<Match> = emptyList(),
    val page: Int = 0,
    val hasMore: Boolean = true,
    val isLoadingMore: Boolean = false,
    val initialLoaded: Boolean = false,
)

@HiltViewModel
class MatchesViewModel @Inject constructor(
    private val api: KingBattleApi,
    private val tokenManager: TokenManager,
) : ViewModel() {

    companion object {
        private const val PAGE_SIZE = 5
    }

    private val _tabStates = MutableStateFlow(MatchTab.entries.associateWith { MatchTabState() })
    val tabStates: StateFlow<Map<MatchTab, MatchTabState>> = _tabStates.asStateFlow()

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

    fun tabState(tab: MatchTab): MatchTabState = _tabStates.value[tab] ?: MatchTabState()

    fun ensureTabLoaded(modeId: String, tab: MatchTab) {
        val state = tabState(tab)
        if (!state.initialLoaded && !state.isLoadingMore && !_isLoading.value) {
            reloadTab(modeId, tab)
        }
    }

    fun reloadTab(modeId: String, tab: MatchTab) {
        viewModelScope.launch {
            updateModeName(modeId)
            loadUser()
            updateTab(tab) { MatchTabState() }
            fetchPage(modeId, tab, page = 1, append = false)
        }
    }

    fun loadMore(modeId: String, tab: MatchTab) {
        val state = tabState(tab)
        if (!state.hasMore || state.isLoadingMore) return
        viewModelScope.launch {
            fetchPage(modeId, tab, page = state.page + 1, append = true)
        }
    }

    fun refreshData(modeId: String) {
        viewModelScope.launch {
            _isRefreshing.value = true
            _errorMessage.value = null
            updateModeName(modeId)
            loadUser()
            syncJoinedMatches()
            coroutineScope {
                MatchTab.entries.map { tab ->
                    async {
                        updateTab(tab) { MatchTabState() }
                        fetchPage(modeId, tab, page = 1, append = false, showBlockingLoader = false)
                    }
                }.awaitAll()
            }
            _isRefreshing.value = false
        }
    }

    /** Initial entry when opening a mode — load only the visible tab first. */
    fun loadData(modeId: String, initialTab: MatchTab = MatchTab.UPCOMING) {
        viewModelScope.launch {
            _errorMessage.value = null
            updateModeName(modeId)
            loadUser()
            syncJoinedMatches()
            _tabStates.value = MatchTab.entries.associateWith { MatchTabState() }
            fetchPage(modeId, initialTab, page = 1, append = false)
        }
    }

    fun onExternalJoinCompleted(modeId: String) {
        val pending = MatchJoinNotifier.consumePending()
        syncJoinedMatches()
        if (pending != null) {
            val (matchId, slotsBooked) = pending
            MatchTab.entries.forEach { tab ->
                updateTab(tab) { state ->
                    state.copy(
                        items = state.items.map { m ->
                            if (m.id == matchId) {
                                m.copy(
                                    participant_count = MatchJoinNotifier.applyServerCount(
                                        matchId,
                                        (m.participant_count ?: 0) + slotsBooked,
                                    ),
                                )
                            } else m
                        },
                    )
                }
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

    private suspend fun fetchPage(
        modeId: String,
        tab: MatchTab,
        page: Int,
        append: Boolean,
        showBlockingLoader: Boolean = true,
    ) {
        if (append) {
            updateTab(tab) { it.copy(isLoadingMore = true) }
        } else if (showBlockingLoader) {
            _isLoading.value = true
        }
        try {
            val response = api.getMatches(
                modeId = modeId,
                status = tab.apiStatus,
                page = page,
                limit = PAGE_SIZE,
                cacheBust = System.currentTimeMillis(),
            )
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                val merged = mergeParticipantCounts(body.items)
                updateTab(tab) { prev ->
                    val nextItems = if (append) {
                        (prev.items + merged).distinctBy { it.id }
                    } else {
                        merged
                    }
                    prev.copy(
                        items = nextItems,
                        page = page,
                        hasMore = body.hasMore,
                        initialLoaded = true,
                        isLoadingMore = false,
                    )
                }
            } else if (!append) {
                updateTab(tab) { MatchTabState(initialLoaded = true, hasMore = false) }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            if (!append) {
                _errorMessage.value = "Failed to load matches: ${e.localizedMessage}"
                updateTab(tab) { MatchTabState(initialLoaded = true, hasMore = false) }
            }
        } finally {
            if (!append && showBlockingLoader) _isLoading.value = false
            if (append) updateTab(tab) { it.copy(isLoadingMore = false) }
        }
    }

    private suspend fun loadUser() {
        try {
            val userRes = api.getCurrentUser()
            if (userRes.isSuccessful && userRes.body() != null) {
                _user.value = userRes.body()!!
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private suspend fun updateModeName(modeId: String) {
        when {
            modeId == "my_matches" -> _modeName.value = "MY MATCHES"
            modeId.contains("solo", ignoreCase = true) -> _modeName.value = "SOLO MATCHES"
            modeId.contains("duo", ignoreCase = true) -> _modeName.value = "DUO MATCHES"
            modeId.contains("squad", ignoreCase = true) -> _modeName.value = "SQUAD MATCHES"
            else -> _modeName.value = "MATCHES"
        }
        try {
            val modesRes = api.getGameModes(null, System.currentTimeMillis())
            if (modesRes.isSuccessful && modesRes.body() != null) {
                modesRes.body()!!.find { it.id == modeId }?.let {
                    _modeName.value = it.name.uppercase() + " MATCHES"
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun mergeParticipantCounts(serverMatches: List<Match>): List<Match> =
        serverMatches.map { m ->
            m.copy(participant_count = MatchJoinNotifier.applyServerCount(m.id, m.participant_count))
        }

    private fun updateTab(tab: MatchTab, transform: (MatchTabState) -> MatchTabState) {
        _tabStates.update { current ->
            current.toMutableMap().apply {
                put(tab, transform(current[tab] ?: MatchTabState()))
            }
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
