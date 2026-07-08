package com.kingbattle.util

import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Pending navigation from notification taps (e.g. match room details).
 * Backend sends FCM data: link=match:{uuid}, matchId={uuid}, type=match_started
 */
object NotificationDeepLink {
    private val _pendingMatchId = MutableStateFlow<String?>(null)
    val pendingMatchId: StateFlow<String?> = _pendingMatchId.asStateFlow()

    private val uuidRegex =
        Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

    private fun isValidMatchId(value: String): Boolean {
        val trimmed = value.trim()
        if (trimmed.isEmpty() || trimmed.length > 128) return false
        return uuidRegex.matches(trimmed) || trimmed.matches(Regex("^[A-Za-z0-9._-]+$"))
    }

    fun parseMatchIdFromLink(link: String?): String? {
        if (link.isNullOrBlank()) return null
        val trimmed = link.trim()
        when {
            trimmed.startsWith("match:", ignoreCase = true) ->
                return trimmed.substringAfter(":").trim().takeIf { isValidMatchId(it) }
            trimmed.startsWith("/match/", ignoreCase = true) ->
                return trimmed.removePrefix("/match/").trim().takeIf { isValidMatchId(it) }
            isValidMatchId(trimmed) -> return trimmed
        }
        return null
    }

    fun parseMatchIdFromIntent(intent: Intent?): String? {
        if (intent == null) return null

        listOf("notification_link", "link").forEach { key ->
            parseMatchIdFromLink(intent.getStringExtra(key))?.let { return it }
        }

        intent.getStringExtra("matchId")?.trim()?.takeIf { isValidMatchId(it) }?.let { return it }

        intent.extras?.let { bundle ->
            bundle.getString("matchId")?.trim()?.takeIf { isValidMatchId(it) }?.let { return it }
            parseMatchIdFromLink(bundle.getString("link"))?.let { return it }
        }

        return null
    }

    fun isMatchStartedNotification(intent: Intent?): Boolean {
        if (intent == null) return false
        val type = intent.getStringExtra("type") ?: intent.extras?.getString("type")
        return type == "match_started" || parseMatchIdFromIntent(intent) != null
    }

    fun setPendingMatchId(matchId: String?) {
        _pendingMatchId.value = matchId?.trim()?.takeIf { isValidMatchId(it) }
    }

    fun consumePendingMatchId(): String? {
        val id = _pendingMatchId.value
        _pendingMatchId.value = null
        return id
    }

    fun handleIntent(intent: Intent?): String? {
        val matchId = parseMatchIdFromIntent(intent) ?: return null
        setPendingMatchId(matchId)
        return matchId
    }
}
