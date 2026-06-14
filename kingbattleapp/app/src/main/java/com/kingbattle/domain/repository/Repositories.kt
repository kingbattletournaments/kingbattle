package com.kingbattle.domain.repository

import com.kingbattle.data.api.AuthInterceptor
import com.kingbattle.data.api.CreateDepositRequest
import com.kingbattle.data.api.CreateWithdrawalRequest
import com.kingbattle.data.api.JoinMatchRequest
import com.kingbattle.data.api.UpdateProfileRequest
import com.kingbattle.domain.model.*

interface AuthRepository {
    suspend fun signUp(email: String, password: String, displayName: String): Result<AuthResponse>
    suspend fun signIn(email: String, password: String): Result<AuthResponse>
    suspend fun logout(): Result<Unit>
}

interface GameRepository {
    suspend fun getGames(): Result<List<Game>>
    suspend fun getGameModes(gameId: String? = null): Result<List<GameMode>>
}

interface MatchRepository {
    suspend fun getMatches(modeId: String? = null): Result<List<Match>>
    suspend fun getMatchDetail(matchId: String): Result<MatchDetail>
    suspend fun joinMatch(matchId: String, request: JoinMatchRequest): Result<Unit>
}

interface UserRepository {
    suspend fun getCurrentUser(): Result<User>
    suspend fun getUserProfile(userId: String): Result<User>
    suspend fun updateUserProfile(userId: String, request: UpdateProfileRequest): Result<User>
    suspend fun getUserTransactions(userId: String): Result<List<Transaction>>
}

interface WalletRepository {
    suspend fun getDepositRequests(): Result<List<DepositRequest>>
    suspend fun createDepositRequest(request: CreateDepositRequest): Result<DepositRequest>
    suspend fun getDepositQrUrl(): Result<String>
    suspend fun getWithdrawalCharge(): Result<Int>
    suspend fun getWithdrawalRequests(): Result<List<WithdrawalRequest>>
    suspend fun createWithdrawalRequest(request: CreateWithdrawalRequest): Result<WithdrawalRequest>
}

interface SystemRepository {
    suspend fun getCustomerSupportUrl(): Result<String>
}
