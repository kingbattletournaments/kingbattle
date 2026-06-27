package com.kingbattle.presentation.matches

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.data.api.SlotInfo
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.TextWhite
import com.kingbattle.presentation.home.ThemeDarkBg

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SlotSelectionScreen(
    matchId: String,
    matchTitle: String,
    onNavigateBack: () -> Unit,
    onNavigateToDetails: () -> Unit,
    viewModel: SlotSelectionViewModel = hiltViewModel(),
) {
    val slotsData by viewModel.slotsData.collectAsState()
    val selected by viewModel.selectedSlots.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val isHolding by viewModel.isHolding.collectAsState()
    val error by viewModel.errorMessage.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(matchId) { viewModel.loadSlots(matchId) }

    LaunchedEffect(error) {
        error?.let {
            Toast.makeText(context, it, Toast.LENGTH_LONG).show()
        }
    }

    Scaffold(
        containerColor = ThemeDarkBg,
        topBar = {
            TopAppBar(
                title = { Text("Select Slots", color = TextWhite, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextWhite)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ThemeDarkBg),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
        ) {
            Text(matchTitle, color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            slotsData?.let { data ->
                val fee = data.entryFee * selected.size.coerceAtLeast(1)
                Text(
                    "${data.matchType.uppercase()} · ${selected.size} selected · $fee coins total",
                    color = TextMuted,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
                )

                if (data.teamSize == 1) {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(56.dp),
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(data.slots) { slot ->
                            SoloSlotChip(
                                slot = slot,
                                selected = selected.contains(slot.slotIndex),
                                onClick = { viewModel.toggleSlot(slot) },
                            )
                        }
                    }
                } else {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        (1..data.teamCount).forEach { teamNum ->
                            TeamSlotBox(
                                teamNumber = teamNum,
                                slots = data.slots.filter { it.teamNumber == teamNum },
                                selected = selected,
                                onToggle = { viewModel.toggleSlot(it) },
                            )
                        }
                    }
                }
            } ?: Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                if (isLoading) CircularProgressIndicator(color = AccentOrange)
            }

            Button(
                onClick = {
                    viewModel.holdAndProceed(matchId) { onNavigateToDetails() }
                },
                enabled = selected.isNotEmpty() && !isHolding,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
            ) {
                Text(if (isHolding) "Reserving..." else "Continue", color = Color.White)
            }
        }
    }
}

@Composable
private fun SoloSlotChip(slot: SlotInfo, selected: Boolean, onClick: () -> Unit) {
    val available = slot.status == "available" || slot.heldByMe
    val bg = when {
        selected -> AccentOrange
        slot.status == "confirmed" -> Color(0xFF334155)
        slot.status == "held" -> Color(0xFF475569)
        else -> Color(0xFF1E293B)
    }
    Box(
        modifier = Modifier
            .size(52.dp)
            .background(bg, RoundedCornerShape(8.dp))
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) Color.White else Color(0xFF475569),
                shape = RoundedCornerShape(8.dp),
            )
            .clickable(enabled = available) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text("${slot.slotIndex}", color = if (available) Color.White else TextMuted, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TeamSlotBox(
    teamNumber: Int,
    slots: List<SlotInfo>,
    selected: Set<Int>,
    onToggle: (SlotInfo) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(10.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text("Team $teamNumber", color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                slots.forEach { slot ->
                    val available = slot.status == "available" || slot.heldByMe
                    val isSelected = selected.contains(slot.slotIndex)
                    val bg = when {
                        isSelected -> AccentOrange
                        slot.status == "confirmed" -> Color(0xFF334155)
                        slot.status == "held" -> Color(0xFF475569)
                        else -> Color(0xFF0F172A)
                    }
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .background(bg, RoundedCornerShape(8.dp))
                            .border(
                                1.dp,
                                if (isSelected) Color.White else Color(0xFF475569),
                                RoundedCornerShape(8.dp),
                            )
                            .clickable(enabled = available) { onToggle(slot) }
                            .padding(vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("Slot ${slot.positionInTeam}", color = TextMuted, fontSize = 10.sp)
                        Text("#${slot.slotIndex}", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinSlotDetailsScreen(
    matchId: String,
    onNavigateBack: () -> Unit,
    onJoinSuccess: () -> Unit,
    viewModel: SlotSelectionViewModel = hiltViewModel(),
) {
    val entries by viewModel.formEntries.collectAsState()
    val slotsData by viewModel.slotsData.collectAsState()
    val isSubmitting by viewModel.isSubmitting.collectAsState()
    val context = LocalContext.current
    val totalFee = (slotsData?.entryFee ?: 0) * entries.size

    Scaffold(
        containerColor = ThemeDarkBg,
        topBar = {
            TopAppBar(
                title = { Text("Player Details", color = TextWhite, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextWhite)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ThemeDarkBg),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "Enter in-game details for each booked slot. Total fee: $totalFee coins.",
                color = TextMuted,
                fontSize = 13.sp,
            )

            entries.forEachIndexed { index, entry ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            if (slotsData?.teamSize == 1) "Slot ${entry.slotIndex}"
                            else "Team ${entry.teamNumber} · Slot ${entry.positionInTeam} (#${entry.slotIndex})",
                            color = TextWhite,
                            fontWeight = FontWeight.Bold,
                        )
                        OutlinedTextField(
                            value = entry.inGameName,
                            onValueChange = { viewModel.updateFormEntry(index, name = it) },
                            label = { Text("In-Game Name") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = AccentOrange,
                                unfocusedBorderColor = Color(0xFF475569),
                            ),
                        )
                        OutlinedTextField(
                            value = entry.inGameUid,
                            onValueChange = { viewModel.updateFormEntry(index, uid = it.filter { c -> c.isDigit() }) },
                            label = { Text("In-Game UID") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = AccentOrange,
                                unfocusedBorderColor = Color(0xFF475569),
                            ),
                        )
                    }
                }
            }

            Button(
                onClick = {
                    viewModel.confirmJoin(
                        matchId,
                        onSuccess = {
                            Toast.makeText(context, "Successfully joined!", Toast.LENGTH_LONG).show()
                            onJoinSuccess()
                        },
                        onError = { msg -> Toast.makeText(context, msg, Toast.LENGTH_LONG).show() },
                    )
                },
                enabled = entries.isNotEmpty() && !isSubmitting,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
            ) {
                Text(if (isSubmitting) "Joining..." else "Confirm & Join", color = Color.White)
            }
        }
    }
}
