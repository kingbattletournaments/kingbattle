package com.kingbattle.presentation.matches

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kingbattle.data.api.HoldSlotsRequest
import com.kingbattle.data.api.JoinMatchRequest
import com.kingbattle.data.api.KingBattleApi
import com.kingbattle.data.api.MatchSlotsResponse
import com.kingbattle.data.api.SlotBookingInput
import com.kingbattle.data.api.SlotInfo
import com.kingbattle.data.local.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SlotFormEntry(
    val slotIndex: Int,
    val teamNumber: Int,
    val positionInTeam: Int,
    var inGameName: String = "",
    var inGameUid: String = "",
)

@HiltViewModel
class SlotSelectionViewModel @Inject constructor(
    private val api: KingBattleApi,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _slotsData = MutableStateFlow<MatchSlotsResponse?>(null)
    val slotsData: StateFlow<MatchSlotsResponse?> = _slotsData.asStateFlow()

    private val _selectedSlots = MutableStateFlow<Set<Int>>(emptySet())
    val selectedSlots: StateFlow<Set<Int>> = _selectedSlots.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isHolding = MutableStateFlow(false)
    val isHolding: StateFlow<Boolean> = _isHolding.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _holdId = MutableStateFlow<String?>(null)
    val holdId: StateFlow<String?> = _holdId.asStateFlow()

    private val _formEntries = MutableStateFlow<List<SlotFormEntry>>(emptyList())
    val formEntries: StateFlow<List<SlotFormEntry>> = _formEntries.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    fun loadSlots(matchId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val res = api.getMatchSlots(matchId)
                if (res.isSuccessful && res.body() != null) {
                    _slotsData.value = res.body()
                } else {
                    _errorMessage.value = res.errorBody()?.string() ?: "Failed to load slots"
                }
            } catch (e: Exception) {
                _errorMessage.value = e.localizedMessage ?: "Failed to load slots"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun toggleSlot(slot: SlotInfo) {
        if (slot.status != "available" && !slot.heldByMe) return
        val data = _slotsData.value ?: return
        val teamSize = data.teamSize
        val current = _selectedSlots.value.toMutableSet()

        if (current.contains(slot.slotIndex)) {
            current.remove(slot.slotIndex)
            _selectedSlots.value = current
            return
        }

        if (teamSize == 1) {
            _selectedSlots.value = setOf(slot.slotIndex)
            return
        }

        if (current.isEmpty()) {
            _selectedSlots.value = setOf(slot.slotIndex)
            return
        }

        val existingTeam = data.slots.find { it.slotIndex == current.first() }?.teamNumber
        if (existingTeam != slot.teamNumber) return
        if (current.size >= teamSize) return

        current.add(slot.slotIndex)
        _selectedSlots.value = current
    }

    fun holdAndProceed(matchId: String, onSuccess: () -> Unit) {
        val selected = _selectedSlots.value.toList().sorted()
        if (selected.isEmpty()) {
            _errorMessage.value = "Select at least one slot"
            return
        }
        viewModelScope.launch {
            _isHolding.value = true
            _errorMessage.value = null
            try {
                val res = api.holdMatchSlots(matchId, HoldSlotsRequest(selected))
                if (res.isSuccessful && res.body()?.holdId != null) {
                    val body = res.body()!!
                    _holdId.value = body.holdId
                    val data = _slotsData.value!!
                    _formEntries.value = selected.map { idx ->
                        val info = data.slots.first { it.slotIndex == idx }
                        SlotFormEntry(
                            slotIndex = idx,
                            teamNumber = info.teamNumber,
                            positionInTeam = info.positionInTeam,
                        )
                    }
                    onSuccess()
                } else {
                    _errorMessage.value = res.errorBody()?.string() ?: "Could not reserve slots"
                    loadSlots(matchId)
                }
            } catch (e: Exception) {
                _errorMessage.value = e.localizedMessage ?: "Could not reserve slots"
            } finally {
                _isHolding.value = false
            }
        }
    }

    fun updateFormEntry(index: Int, name: String? = null, uid: String? = null) {
        _formEntries.value = _formEntries.value.mapIndexed { i, entry ->
            if (i == index) {
                entry.copy(
                    inGameName = name ?: entry.inGameName,
                    inGameUid = uid ?: entry.inGameUid,
                )
            } else entry
        }
    }

    fun confirmJoin(matchId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        val hold = _holdId.value ?: run {
            onError("Hold expired. Go back and select slots again.")
            return
        }
        val entries = _formEntries.value
        if (entries.any { it.inGameName.isBlank() || it.inGameUid.length < 6 }) {
            onError("Enter valid in-game name and UID for each slot")
            return
        }
        viewModelScope.launch {
            _isSubmitting.value = true
            try {
                val res = api.joinMatch(
                    matchId,
                    JoinMatchRequest(
                        hold_id = hold,
                        slots = entries.map {
                            SlotBookingInput(
                                slotIndex = it.slotIndex,
                                inGameName = it.inGameName.trim(),
                                inGameUid = it.inGameUid.trim(),
                            )
                        },
                    ),
                )
                if (res.isSuccessful) {
                    tokenManager.saveJoinedMatch(matchId)
                    val body = res.body()
                    val slotsBooked = body?.slotsBooked ?: entries.size
                    val participantCount = body?.participantCount
                    MatchJoinNotifier.notifyJoined(matchId, slotsBooked, participantCount)
                    onSuccess()
                } else {
                    onError(res.errorBody()?.string() ?: "Failed to join")
                }
            } catch (e: Exception) {
                onError(e.localizedMessage ?: "Failed to join")
            } finally {
                _isSubmitting.value = false
            }
        }
    }
}
