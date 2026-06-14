package com.kingbattle.domain.model

import com.google.gson.annotations.SerializedName
import com.kingbattle.data.api.TeamMember

data class ApiResponse<T>(
    val data: T? = null,
    val error: String? = null,
    val success: Boolean = false
)

data class AuthRequest(
    val email: String,
    val password: String
)

data class SignUpRequest(
    val email: String,
    val password: String,
    val display_name: String,
    val username: String? = null,
    @SerializedName("referredBy", alternate = ["referred_by"])
    val referred_by: String? = null
)

data class User(
    val id: String,
    val email: String,
    @SerializedName("display_name", alternate = ["displayName"])
    val display_name: String,
    @SerializedName("in_game_name", alternate = ["inGameName"])
    val in_game_name: String? = null,
    @SerializedName("in_game_uid", alternate = ["inGameUid"])
    val in_game_uid: String? = null,
    val coins: Int,
    @SerializedName("lifetime_earned_points", alternate = ["lifetimeEarnedPoints"])
    val lifetime_earned_points: Int = 0,
    @SerializedName("matches_played", alternate = ["matchesPlayed"])
    val matches_played: Int = 0,
    @SerializedName("total_kills", alternate = ["totalKills"])
    val total_kills: Int = 0,
    val username: String? = null,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String? = null,
    @SerializedName("updated_at", alternate = ["updatedAt"])
    val updated_at: String? = null
)

data class AuthResponse(
    val user: User,
    val session: SessionData
)

data class SessionData(
    val access_token: String,
    val refresh_token: String?,
    val expires_in: Int,
    val token_type: String = "Bearer"
)

data class Game(
    val id: String,
    val name: String,
    @SerializedName("image_url", alternate = ["imageUrl"])
    val image_url: String?,
    @SerializedName("display_order", alternate = ["displayOrder"])
    val display_order: Int? = 0,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String? = null,
    @SerializedName("updated_at", alternate = ["updatedAt"])
    val updated_at: String? = null
)

data class GameMode(
    val id: String,
    @SerializedName("game_id", alternate = ["gameId"])
    val game_id: String,
    val name: String,
    @SerializedName("image_url", alternate = ["imageUrl"])
    val image_url: String?,
    @SerializedName("display_order", alternate = ["displayOrder"])
    val display_order: Int? = 0,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String? = null,
    @SerializedName("updated_at", alternate = ["updatedAt"])
    val updated_at: String? = null
)

data class Match(
    val id: String,
    @SerializedName("game_mode_id", alternate = ["gameModeId"])
    val game_mode_id: String,
    val title: String,
    @SerializedName("entry_fee", alternate = ["entryFee"])
    val entry_fee: Int,
    @SerializedName("room_code", alternate = ["roomCode"])
    val room_code: String?,
    @SerializedName("room_password", alternate = ["roomPassword"])
    val room_password: String?,
    val status: String,
    @SerializedName("registration_locked", alternate = ["registrationLocked"])
    val registration_locked: Boolean,
    @SerializedName("max_participants", alternate = ["maxParticipants"])
    val max_participants: Int,
    @SerializedName("starts_at", alternate = ["startsAt", "scheduledAt"])
    val starts_at: String,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String? = null,
    @SerializedName("updated_at", alternate = ["updatedAt"])
    val updated_at: String? = null,
    @SerializedName("participant_count", alternate = ["participantCount"])
    val participant_count: Int? = null,
    @SerializedName("matchType", alternate = ["match_type"])
    val matchType: String? = "solo",
    @SerializedName("prizePool", alternate = ["prize_pool"])
    val prizePool: PrizePool? = null,
    @SerializedName("version")
    val version: String? = "TPP",
    @SerializedName("map")
    val map: String? = "BERMUDA",
    @SerializedName("image")
    val image: String? = null
)

data class MatchDetail(
    val match: Match,
    val participants: List<Participant>,
    val prize_pool: PrizePool?
)

data class Participant(
    val id: String,
    @SerializedName("user_id", alternate = ["userId"])
    val user_id: String,
    @SerializedName("in_game_name", alternate = ["inGameName"])
    val in_game_name: String? = null,
    @SerializedName("in_game_uid", alternate = ["inGameUid"])
    val in_game_uid: String? = null,
    @SerializedName("joined_at", alternate = ["joinedAt"])
    val joined_at: String,
    @SerializedName("team_members", alternate = ["teamMembers"])
    val team_members: List<TeamMember>? = null
)

data class PrizePool(
    @SerializedName("coins_per_kill", alternate = ["coinsPerKill"])
    val coins_per_kill: Int,
    @SerializedName("total_prize_pool", alternate = ["totalPrizePool"])
    val total_prize_pool: Int?,
    @SerializedName("rank_rewards", alternate = ["rankRewards"])
    val rank_rewards: List<RankReward>
)

data class RankReward(
    @SerializedName("from_rank", alternate = ["fromRank"])
    val from_rank: Int,
    @SerializedName("to_rank", alternate = ["toRank"])
    val to_rank: Int,
    val coins: Int
)

data class Transaction(
    val id: String,
    @SerializedName("user_id", alternate = ["userId"])
    val user_id: String? = null,
    val amount: Int,
    val type: String,
    @SerializedName("reference_id", alternate = ["referenceId"])
    val reference_id: String? = null,
    @SerializedName("description", alternate = ["note"])
    val description: String?,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String,
    val status: String? = null
)

data class DepositRequest(
    val id: String,
    @SerializedName("user_id", alternate = ["userId"])
    val user_id: String,
    val amount: Int,
    val utr: String,
    val status: String,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String,
    @SerializedName("updated_at", alternate = ["updatedAt"])
    val updated_at: String? = null
)

data class WithdrawalRequest(
    val id: String,
    @SerializedName("user_id", alternate = ["userId"])
    val user_id: String,
    val amount: Int,
    @SerializedName("upi_id", alternate = ["upiId"])
    val upi_id: String,
    val status: String,
    @SerializedName("rejection_reason", alternate = ["rejectNote"])
    val rejection_reason: String?,
    @SerializedName("charge_percent", alternate = ["chargePercent"])
    val charge_percent: Double? = null,
    @SerializedName("created_at", alternate = ["createdAt"])
    val created_at: String,
    @SerializedName("updated_at", alternate = ["updatedAt"])
    val updated_at: String? = null
)

data class SystemConfig(
    @SerializedName("deposit_qr_url", alternate = ["depositQrUrl"])
    val deposit_qr_url: String?,
    @SerializedName("customer_support_url", alternate = ["customerSupportUrl"])
    val customer_support_url: String?,
    val signup_bonus: Int,
    val withdrawal_charge: Int
)

data class LeaderboardUser(
    val id: String,
    @SerializedName("displayName", alternate = ["display_name"])
    val displayName: String,
    val coins: Int
)

data class AppBanner(
    val id: String,
    @SerializedName("image_url", alternate = ["imageUrl"])
    val imageUrl: String,
    @SerializedName("link_url", alternate = ["linkUrl"])
    val linkUrl: String,
    @SerializedName("display_play_carousel", alternate = ["displayPlayCarousel"])
    val displayPlayCarousel: Boolean = false,
    @SerializedName("display_earn", alternate = ["displayEarn"])
    val displayEarn: Boolean = false
)

data class ReferralSettings(
    val enabled: Boolean,
    @SerializedName("rewardCoins", alternate = ["reward_coins"])
    val rewardCoins: Int,
    @SerializedName("bannerUrl", alternate = ["banner_url"])
    val bannerUrl: String,
    @SerializedName("signupBonus", alternate = ["signup_bonus"])
    val signupBonus: Int = 5
)

