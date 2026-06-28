package com.kingbattle.presentation.matches

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Cross-screen signal when a user completes match registration (slot join). */
object MatchJoinNotifier {
    private val _version = MutableStateFlow(0)
    val version: StateFlow<Int> = _version.asStateFlow()

    private var pendingMatchId: String? = null
    private var pendingSlotsBooked: Int = 0

    fun notifyJoined(matchId: String, slotsBooked: Int) {
        pendingMatchId = matchId
        pendingSlotsBooked = slotsBooked.coerceAtLeast(1)
        _version.value += 1
    }

    fun consumePending(): Pair<String, Int>? {
        val id = pendingMatchId ?: return null
        val slots = pendingSlotsBooked
        pendingMatchId = null
        pendingSlotsBooked = 0
        return id to slots
    }
}
