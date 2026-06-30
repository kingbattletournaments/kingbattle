package com.kingbattle.presentation.matches

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.BuildConfig
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
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(matchTitle, color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            slotsData?.let { data ->
                val fee = data.entryFee * selected.size.coerceAtLeast(1)
                Text(
                    "${data.matchType.uppercase()} · ${selected.size} selected · $fee coins total",
                    color = TextMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 2.dp, bottom = 8.dp),
                )

                if (data.teamSize == 1) {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 44.dp),
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        contentPadding = PaddingValues(bottom = 4.dp),
                    ) {
                        items(data.slots, key = { it.slotIndex }) { slot ->
                            CompactSlotCheckbox(
                                slotLabel = "${slot.slotIndex}",
                                slot = slot,
                                selected = selected.contains(slot.slotIndex),
                                onClick = { viewModel.toggleSlot(slot) },
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        contentPadding = PaddingValues(bottom = 4.dp),
                    ) {
                        items((1..data.teamCount).toList(), key = { it }) { teamNum ->
                            TeamSlotRow(
                                teamNumber = teamNum,
                                slots = data.slots
                                    .filter { it.teamNumber == teamNum }
                                    .sortedBy { it.positionInTeam },
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
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
            ) {
                Text(if (isHolding) "Reserving..." else "Continue", color = Color.White)
            }
        }
    }
}

@Composable
private fun CompactSlotCheckbox(
    slotLabel: String,
    slot: SlotInfo,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val available = slot.status == "available" || slot.heldByMe
    val boxColor = when {
        selected -> AccentOrange
        slot.status == "confirmed" -> Color(0xFF334155)
        slot.status == "held" && !slot.heldByMe -> Color(0xFF475569)
        else -> Color(0xFF0F172A)
    }
    val borderColor = when {
        selected -> Color.White
        !available -> Color(0xFF334155)
        else -> Color(0xFF64748B)
    }

    Column(
        modifier = Modifier
            .widthIn(min = 36.dp)
            .clickable(enabled = available) { onClick() },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(boxColor)
                .border(1.dp, borderColor, RoundedCornerShape(4.dp)),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
        Text(
            text = slotLabel,
            color = if (available) TextWhite else TextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 3.dp),
        )
    }
}

@Composable
private fun TeamSlotRow(
    teamNumber: Int,
    slots: List<SlotInfo>,
    selected: Set<Int>,
    onToggle: (SlotInfo) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF1E293B))
            .padding(start = 10.dp, end = 10.dp, top = 7.dp, bottom = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Team $teamNumber",
            color = TextWhite,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
        )

        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(modifier = Modifier.weight(1f))
            slots.forEach { slot ->
                CompactSlotCheckbox(
                    slotLabel = "${slot.positionInTeam}",
                    slot = slot,
                    selected = selected.contains(slot.slotIndex),
                    onClick = { onToggle(slot) },
                )
                Spacer(modifier = Modifier.weight(1f))
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
    val requireUid = BuildConfig.REQUIRE_IN_GAME_UID && slotsData?.requireInGameUid == true
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
                if (requireUid) {
                    "Enter in-game name and UID for each booked slot. Total fee: $totalFee coins."
                } else {
                    "Enter in-game name for each booked slot. Total fee: $totalFee coins."
                },
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
                            else "Team ${entry.teamNumber} · Slot ${entry.positionInTeam}",
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
                        if (requireUid) {
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
