package com.kingbattle.data.api

import com.google.gson.annotations.SerializedName

data class MatchSlotsResponse(
    @SerializedName("matchType") val matchType: String,
    @SerializedName("maxParticipants") val maxParticipants: Int,
    @SerializedName("teamSize") val teamSize: Int,
    @SerializedName("teamCount") val teamCount: Int,
    @SerializedName("entryFee") val entryFee: Int,
    @SerializedName("joinedCount") val joinedCount: Int? = null,
    @SerializedName("requireInGameUid") val requireInGameUid: Boolean = false,
    val slots: List<SlotInfo>,
)

data class SlotInfo(
    @SerializedName("slotIndex") val slotIndex: Int,
    @SerializedName("teamNumber") val teamNumber: Int,
    @SerializedName("positionInTeam") val positionInTeam: Int,
    val status: String,
    @SerializedName("heldByMe") val heldByMe: Boolean,
)

data class HoldSlotsRequest(
    @SerializedName("slot_indices") val slotIndices: List<Int>,
)

data class HoldSlotsResponse(
    @SerializedName("holdId") val holdId: String,
    @SerializedName("expiresInSeconds") val expiresInSeconds: Int,
)

data class SlotBookingInput(
    @SerializedName("slot_index") val slotIndex: Int,
    @SerializedName("in_game_name") val inGameName: String,
    @SerializedName("in_game_uid") val inGameUid: String = "",
)
