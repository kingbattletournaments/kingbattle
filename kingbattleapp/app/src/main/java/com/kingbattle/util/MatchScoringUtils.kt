package com.kingbattle.util

import com.kingbattle.domain.model.ManualEntryOptions
import com.kingbattle.domain.model.Match
import com.kingbattle.domain.model.Participant
import com.kingbattle.domain.model.PrizePool
import com.kingbattle.domain.model.RankReward

object MatchScoringUtils {
    fun hasActiveRankRewards(rewards: List<RankReward>?): Boolean {
        return rewards.orEmpty().any { it.coins > 0 && it.from_rank > 0 && it.to_rank >= it.from_rank }
    }

    fun visibleRankRewards(rewards: List<RankReward>?): List<RankReward> {
        return rewards.orEmpty().filter { it.coins > 0 && it.from_rank > 0 && it.to_rank >= it.from_rank }
    }

    fun resolveScoringMode(match: Match): String {
        val stored = match.scoring_mode?.trim()?.lowercase()
        if (!stored.isNullOrBlank() && stored in setOf("kills_only", "rank_only", "rank_kills", "manual")) {
            return stored
        }
        val pool = match.prizePool ?: return "kills_only"
        val cpk = pool.coins_per_kill
        val ranks = hasActiveRankRewards(pool.rank_rewards)
        return when {
            ranks && cpk > 0 -> "rank_kills"
            ranks && cpk == 0 -> "rank_only"
            else -> "kills_only"
        }
    }

    fun shouldShowRankRewards(match: Match): Boolean {
        return hasActiveRankRewards(match.prizePool?.rank_rewards)
    }

    fun shouldShowPerKill(match: Match): Boolean {
        val mode = resolveScoringMode(match)
        val cpk = match.prizePool?.coins_per_kill ?: 0
        return cpk > 0 && mode != "rank_only"
    }

    fun sortParticipants(participants: List<Participant>, match: Match): List<Participant> {
        val mode = resolveScoringMode(match)
        return if (mode == "kills_only") {
            participants.sortedWith(
                compareByDescending<Participant> { participantTotalKills(it) }
                    .thenBy { it.rank ?: Int.MAX_VALUE }
            )
        } else {
            participants.sortedWith(
                compareBy<Participant> { it.rank ?: Int.MAX_VALUE }
                    .thenByDescending { participantTotalKills(it) }
            )
        }
    }

    fun participantTotalKills(participant: Participant): Int {
        return participant.team_members?.sumOf { it.kills ?: 0 }
            ?: participant.team_members?.firstOrNull()?.kills
            ?: 0
    }

    fun calcCoinsWon(participant: Participant, prizePool: PrizePool?, match: Match): Int {
        if (prizePool == null) return 0
        val mode = resolveScoringMode(match)
        val kills = participantTotalKills(participant)
        val rank = participant.rank
        val rankCoins = if (rank != null) {
            visibleRankRewards(prizePool.rank_rewards).firstOrNull { rank in it.from_rank..it.to_rank }?.coins ?: 0
        } else 0
        return when (mode) {
            "kills_only" -> kills * prizePool.coins_per_kill
            "rank_only" -> rankCoins
            "rank_kills" -> rankCoins + kills * prizePool.coins_per_kill
            else -> rankCoins + kills * prizePool.coins_per_kill
        }
    }
}
