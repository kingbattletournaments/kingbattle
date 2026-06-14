package com.kingbattle.data.api

import com.google.gson.annotations.SerializedName

// Auth Request Models (used by KingBattleApi interface)
data class AuthRequest(
    val email: String,
    val password: String
)

data class SignUpRequest(
    val email: String,
    val password: String,
    val display_name: String,
    val username: String? = null,
    @SerializedName("referredBy")
    val referred_by: String? = null
)

