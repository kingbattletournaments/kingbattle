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

    /** Minimum joined count we know is true before the server list catches up. */
    private val knownFloorCounts = mutableMapOf<String, Int>()

    fun notifyJoined(matchId: String, slotsBooked: Int, participantCount: Int? = null) {
        pendingMatchId = matchId
        pendingSlotsBooked = slotsBooked.coerceAtLeast(1)
        val floor = participantCount ?: ((knownFloorCounts[matchId] ?: 0) + pendingSlotsBooked)
        knownFloorCounts[matchId] = maxOf(knownFloorCounts[matchId] ?: 0, floor)
        _version.value += 1
    }

    fun consumePending(): Pair<String, Int>? {
        val id = pendingMatchId ?: return null
        val slots = pendingSlotsBooked
        pendingMatchId = null
        pendingSlotsBooked = 0
        return id to slots
    }

    fun effectiveParticipantCount(matchId: String, serverCount: Int?): Int {
        val server = serverCount ?: 0
        val floor = knownFloorCounts[matchId] ?: 0
        val effective = maxOf(server, floor)
        if (server >= floor) {
            knownFloorCounts.remove(matchId)
        }
        return effective
    }

    fun applyServerCount(matchId: String, serverCount: Int?): Int {
        return effectiveParticipantCount(matchId, serverCount)
    }
}
