package com.kingbattle.data.api

import com.google.gson.annotations.SerializedName
import com.kingbattle.domain.model.*
import retrofit2.Response
import retrofit2.http.*

interface KingBattleApi {

    // ===== Authentication =====
    @POST("auth/signup")
    suspend fun signUp(@Body request: SignUpRequest): Response<AuthResponse>

    @POST("auth/signin")
    suspend fun signIn(@Body request: AuthRequest): Response<AuthResponse>

    @POST("auth/google")
    suspend fun googleSignIn(@Body request: GoogleAuthRequest): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<Unit>

    // ===== Games & Modes =====
    @GET("games")
    suspend fun getGames(): Response<List<Game>>

    @GET("modes")
    suspend fun getGameModes(
        @Query("gameId") gameId: String? = null,
        @Query("_ts") cacheBust: Long? = null,
    ): Response<List<GameMode>>

    // ===== Matches (always live from server — paginated, never cached) =====
    @GET("matches")
    suspend fun getMatches(
        @Query("modeId") modeId: String,
        @Query("status") status: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 5,
        @Query("_ts") cacheBust: Long? = null,
    ): Response<PaginatedMatchesResponse>

    @GET("matches/{id}")
    suspend fun getMatch(@Path("id") matchId: String): Response<Match>

    @POST("matches/{id}/join")
    suspend fun joinMatch(
        @Path("id") matchId: String,
        @Body request: JoinMatchRequest
    ): Response<JoinMatchResponse>

    @GET("matches/{id}/slots")
    suspend fun getMatchSlots(@Path("id") matchId: String): Response<MatchSlotsResponse>

    @POST("matches/{id}/slots/hold")
    suspend fun holdMatchSlots(
        @Path("id") matchId: String,
        @Body request: HoldSlotsRequest
    ): Response<HoldSlotsResponse>

    @GET("matches/{id}/participants")
    suspend fun getMatchParticipants(@Path("id") matchId: String): Response<List<Participant>>

    // ===== User Profile =====
    @GET("users/me")
    suspend fun getCurrentUser(): Response<User>

    @GET("users/{id}")
    suspend fun getUserProfile(@Path("id") userId: String): Response<User>

    @PUT("users/{id}")
    suspend fun updateUserProfile(
        @Path("id") userId: String,
        @Body request: UpdateProfileRequest
    ): Response<User>

    @POST("users/fcm-token")
    suspend fun updateFcmToken(
        @Body request: UpdateFcmTokenRequest
    ): Response<UpdateFcmTokenResponse>

    @GET("users/{id}/transactions")
    suspend fun getUserTransactions(@Path("id") userId: String): Response<List<Transaction>>

    // ===== Wallet & Deposits =====
    @GET("deposits")
    suspend fun getDepositRequests(): Response<List<DepositRequest>>

    @POST("deposits")
    suspend fun createDepositRequest(
        @Body request: CreateDepositRequest
    ): Response<DepositRequest>

    @GET("deposit-qr")
    suspend fun getDepositQrUrl(): Response<Map<String, String>>

    @POST("deposits/zapupi")
    suspend fun createZapUpiOrder(
        @Body request: CreateZapUpiOrderRequest
    ): Response<ZapUpiOrderResponse>

    @GET("deposits/zapupi/status")
    suspend fun checkZapUpiOrderStatus(
        @Query("order_id") orderId: String
    ): Response<Map<String, String>>

    // ===== Withdrawals =====
    @GET("withdrawal-charge")
    suspend fun getWithdrawalCharge(): Response<Map<String, Int>>

    @GET("withdrawals")
    suspend fun getWithdrawalRequests(): Response<List<WithdrawalRequest>>

    @POST("withdrawals")
    suspend fun createWithdrawalRequest(
        @Body request: CreateWithdrawalRequest
    ): Response<WithdrawalRequest>

    // ===== Support =====
    @GET("customer-support")
    suspend fun getCustomerSupportUrl(): Response<CustomerSupportResponse>

    @GET("announcement")
    suspend fun getAnnouncement(): Response<Map<String, String>>

    @GET("banners")
    suspend fun getBanners(): Response<List<com.kingbattle.domain.model.AppBanner>>

    @GET("referral-settings")
    suspend fun getReferralSettings(): Response<ReferralSettings>

    @GET("leaderboard")
    suspend fun getLeaderboard(): Response<List<com.kingbattle.domain.model.LeaderboardUser>>
}

// Request Models
data class PaginatedMatchesResponse(
    val items: List<Match> = emptyList(),
    val page: Int = 1,
    @SerializedName("pageSize") val pageSize: Int = 5,
    val total: Int = 0,
    @SerializedName("totalPages") val totalPages: Int = 1,
    @SerializedName("hasMore") val hasMore: Boolean = false,
)

data class JoinMatchResponse(
    val success: Boolean = true,
    @SerializedName("slotsBooked") val slotsBooked: Int? = null,
    @SerializedName("participantCount") val participantCount: Int? = null,
)

data class JoinMatchRequest(
    val in_game_name: String? = null,
    val in_game_uid: String? = null,
    val team_members: List<TeamMember>? = null,
    val hold_id: String? = null,
    val slots: List<SlotBookingInput>? = null,
)

data class GoogleAuthRequest(
    val idToken: String
)

data class TeamMember(
    val in_game_name: String,
    val in_game_uid: String
)

data class UpdateProfileRequest(
    val display_name: String? = null,
    val in_game_name: String? = null,
    val in_game_uid: String? = null
)

data class CreateDepositRequest(
    val amount: Int,
    val utr: String
)

data class CreateWithdrawalRequest(
    val amount: Int,
    val upiId: String
)

data class CreateZapUpiOrderRequest(
    val amount: Int
)

data class ZapUpiOrderResponse(
    val status: String,
    val payment_url: String,
    val order_id: String
)

data class UpdateFcmTokenRequest(
    val fcmToken: String
)

data class UpdateFcmTokenResponse(
    val success: Boolean,
    val userId: String? = null,
)
