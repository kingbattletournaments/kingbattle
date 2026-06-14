package com.kingbattle.presentation.matches

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import kotlinx.coroutines.launch
import com.kingbattle.R
import com.kingbattle.domain.model.Match
import com.kingbattle.presentation.home.ThemeDarkBg
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.AccentGold
import com.kingbattle.presentation.home.TextWhite
import com.kingbattle.presentation.home.TextMuted

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchesScreen(
    modeId: String,
    initialTab: Int = 1,
    onNavigateBack: () -> Unit,
    onNavigateToWallet: () -> Unit,
    onNavigateToMatchDetail: (String) -> Unit,
    viewModel: MatchesViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val matchesState = viewModel.matches.collectAsState()
    val userState = viewModel.user.collectAsState()
    val isLoadingState = viewModel.isLoading.collectAsState()
    val errorMessageState = viewModel.errorMessage.collectAsState()
    val modeNameState = viewModel.modeName.collectAsState()

    val tabs = remember { listOf("ONGOING", "UPCOMING", "RESULTS") }
    val coroutineScope = rememberCoroutineScope()
    val pagerState = rememberPagerState(initialPage = initialTab, pageCount = { tabs.size })

    var selectedMatchToJoin by remember { mutableStateOf<Match?>(null) }
    var showJoinDialog by remember { mutableStateOf(false) }

    LaunchedEffect(modeId) {
        viewModel.loadData(modeId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = modeNameState.value,
                        color = TextWhite,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = TextWhite
                        )
                    }
                },
                actions = {
                    // Coin balance pill matching the exact reference style (white capsule, dark text)
                    val formattedCoins = String.format("%.2f", userState.value?.coins?.toDouble() ?: 0.0)
                    Row(
                        modifier = Modifier
                            .padding(end = 12.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color.White)
                            .clickable { onNavigateToWallet() }
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "💵",
                            fontSize = 14.sp
                        )
                        Text(
                            text = formattedCoins,
                            color = Color.Black,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = ThemeDarkBg
                )
            )
        },
        containerColor = ThemeDarkBg
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tab navigation bar linked to pager state
            TabRow(
                selectedTabIndex = pagerState.currentPage,
                containerColor = ThemeDarkBg,
                contentColor = AccentOrange,
                indicator = { tabPositions ->
                    TabRowDefaults.Indicator(
                        modifier = Modifier.tabIndicatorOffset(tabPositions[pagerState.currentPage]),
                        color = AccentOrange
                    )
                }
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = pagerState.currentPage == index,
                        onClick = {
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(index)
                            }
                        },
                        text = {
                            Text(
                                text = title,
                                color = if (pagerState.currentPage == index) Color.White else TextMuted,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    )
                }
            }

            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxSize()
                    .weight(1f)
            ) { page ->
                // Filter matches based on current page index status
                val filteredMatches = remember(matchesState.value, page) {
                    matchesState.value.filter { match ->
                        when (page) {
                            0 -> match.status.equals("ongoing", ignoreCase = true)
                            1 -> match.status.equals("upcoming", ignoreCase = true)
                            2 -> match.status.equals("completed", ignoreCase = true) ||
                                 match.status.equals("finished", ignoreCase = true) ||
                                 match.status.equals("cancelled", ignoreCase = true)
                            else -> false
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF030D1E)) // Dark blue/navy page background
                ) {
                    if (isLoadingState.value && matchesState.value.isEmpty()) {
                        CircularProgressIndicator(
                            modifier = Modifier.align(Alignment.Center),
                            color = AccentOrange
                        )
                    } else if (filteredMatches.isEmpty()) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "🎮",
                                fontSize = 44.sp
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No ${tabs[page]} Matches",
                                color = TextWhite,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Check other categories or try again later.",
                                color = TextMuted,
                                fontSize = 13.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            items(filteredMatches) { match ->
                                MatchCard(
                                    match = match,
                                    onJoinClick = {
                                        val userCoins = userState.value?.coins ?: 0
                                        if (userCoins < match.entry_fee) {
                                            Toast.makeText(context, "Insufficient coins! Please deposit first.", Toast.LENGTH_LONG).show()
                                            onNavigateToWallet()
                                        } else {
                                            selectedMatchToJoin = match
                                            showJoinDialog = true
                                        }
                                    },
                                    onCardClick = {
                                        onNavigateToMatchDetail(match.id)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Join Match Input Dialog
    if (showJoinDialog && selectedMatchToJoin != null) {
        val match = selectedMatchToJoin!!
        JoinMatchDialog(
            entryFee = match.entry_fee,
            savedName = userState.value?.in_game_name ?: "",
            savedUid = userState.value?.in_game_uid ?: "",
            onDismiss = {
                showJoinDialog = false
                selectedMatchToJoin = null
            },
            onSubmit = { ign, igid ->
                showJoinDialog = false
                viewModel.joinMatch(
                    matchId = match.id,
                    inGameName = ign,
                    inGameUid = igid,
                    onSuccess = {
                        Toast.makeText(context, "Successfully joined tournament!", Toast.LENGTH_LONG).show()
                        viewModel.loadData(modeId)
                        selectedMatchToJoin = null
                    },
                    onError = { err ->
                        Toast.makeText(context, "Failed: $err", Toast.LENGTH_LONG).show()
                        selectedMatchToJoin = null
                    }
                )
            }
        )
    }
}

@Composable
fun MatchCard(
    match: Match,
    onJoinClick: () -> Unit,
    onCardClick: () -> Unit
) {
    var rewardsExpanded by remember { mutableStateOf(false) }
    val context = LocalContext.current

    // Cover banner mapping based on image field or title content
    val bannerRes = remember(match.image, match.title) {
        val customResId = match.image?.let {
            context.resources.getIdentifier(it, "drawable", context.packageName)
        } ?: 0
        if (customResId != 0) {
            customResId
        } else {
            when {
                match.title.contains("duo", ignoreCase = true) -> R.drawable.duo
                match.title.contains("squad", ignoreCase = true) -> R.drawable.squad
                else -> R.drawable.solo
            }
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCardClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // 1. Top Banner Image (16:9)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            ) {
                Image(
                    painter = painterResource(id = bannerRes),
                    contentDescription = "Match Banner",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }

            // 2. Info Row: Clash War logo, Match Title, Date/Time
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.app_logo),
                    contentDescription = "Clash War Logo",
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(6.dp)),
                    contentScale = ContentScale.Crop
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = match.title,
                        color = Color(0xFF1E293B),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = match.starts_at,
                        color = Color(0xFF64748B),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Divider(modifier = Modifier.padding(horizontal = 16.dp), color = Color(0xFFF1F5F9))

            // 3. Stats Grid (3 columns, 2 rows)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Row 1: Prize Pool, Per Kill, Entry Fee
                Row(modifier = Modifier.fillMaxWidth()) {
                    // Prize Pool Column (Clickable chevron dropdown)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { rewardsExpanded = !rewardsExpanded },
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "PRIZE POOL",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(text = "💵", fontSize = 13.sp)
                            Text(
                                text = "${match.prizePool?.total_prize_pool ?: 500}",
                                color = Color(0xFF1E293B),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Icon(
                                imageVector = if (rewardsExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = "Rewards Toggle",
                                tint = Color(0xFF64748B),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    // Per Kill Column
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "PER KILL",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(text = "💵", fontSize = 13.sp)
                            Text(
                                text = "${match.prizePool?.coins_per_kill ?: 10}",
                                color = Color(0xFF1E293B),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // Entry Fee Column
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "ENTRY FEE",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(text = "💵", fontSize = 13.sp)
                            Text(
                                text = "${match.entry_fee}",
                                color = Color(0xFF1E293B),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Row 2: Type, Version, Map
                Row(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "TYPE",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = match.matchType?.replaceFirstChar { it.uppercase() } ?: "Solo",
                            color = Color(0xFF1E293B),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "VERSION",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "TPP",
                            color = Color(0xFF1E293B),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "MAP",
                            color = Color(0xFF64748B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = match.map ?: "BERMUDA",
                            color = Color(0xFF1E293B),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Animated Rewards Listing inside the white Card
                AnimatedVisibility(visible = rewardsExpanded) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(6.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8FAFC)),
                        border = BorderStroke(1.dp, Color(0xFFE2E8F0))
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text(
                                text = "RANK DISTRIBUTION REWARDS",
                                color = Color(0xFF475569),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            val rewards = match.prizePool?.rank_rewards ?: emptyList()
                            if (rewards.isEmpty()) {
                                Text(
                                    text = "All prizes distributed via per-kill earnings.",
                                    color = Color(0xFF64748B),
                                    fontSize = 11.sp
                                )
                            } else {
                                rewards.forEach { reward ->
                                    val rankText = if (reward.from_rank == reward.to_rank) {
                                        "Rank ${reward.from_rank}"
                                    } else {
                                        "Rank ${reward.from_rank} - ${reward.to_rank}"
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(rankText, color = Color(0xFF475569), fontSize = 11.sp)
                                        Text("💵 ${reward.coins} coins", color = Color(0xFF1E293B), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Progress bar and Join button row
                val spotsTaken = match.participant_count ?: 0
                val progress = spotsTaken.toFloat() / match.max_participants.toFloat()

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        LinearProgressIndicator(
                            progress = progress.coerceIn(0f, 1f),
                            color = Color(0xFF7C3AED), // Premium purple spots progress indicator
                            trackColor = Color(0xFFF1F5F9),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "$spotsTaken/${match.max_participants}",
                            color = Color(0xFF64748B),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Button actions depending on state
                    val btnEnabled = match.status.equals("upcoming", ignoreCase = true) && !match.registration_locked
                    val btnText = when {
                        match.status.equals("ongoing", ignoreCase = true) -> "ONGOING"
                        match.status.equals("completed", ignoreCase = true) ||
                        match.status.equals("finished", ignoreCase = true) -> "COMPLETED"
                        match.status.equals("cancelled", ignoreCase = true) -> "CANCELLED"
                        match.registration_locked -> "LOCKED"
                        else -> "JOIN"
                    }

                    Button(
                        onClick = onJoinClick,
                        enabled = btnEnabled,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF7C3AED), // Purple join button
                            contentColor = Color.White,
                            disabledContainerColor = Color(0xFFCBD5E1),
                            disabledContentColor = Color(0xFF94A3B8)
                        ),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.height(36.dp),
                        contentPadding = PaddingValues(horizontal = 24.dp)
                    ) {
                        Text(
                            text = btnText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun JoinMatchDialog(
    entryFee: Int,
    savedName: String,
    savedUid: String,
    onDismiss: () -> Unit,
    onSubmit: (inGameName: String, inGameUid: String) -> Unit
) {
    var ignText by remember { mutableStateOf(savedName) }
    var igidText by remember { mutableStateOf(savedUid) }
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Join Tournament",
                color = TextWhite,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Ensure your Free Fire details are correct. Entry fee of $entryFee coins will be deducted from your wallet balance.",
                    color = TextMuted,
                    fontSize = 12.sp
                )

                // IGN Input
                OutlinedTextField(
                    value = ignText,
                    onValueChange = { ignText = it },
                    label = { Text("In-Game Name (IGN)") },
                    placeholder = { Text("e.g. ProGamer123") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = AccentOrange,
                        unfocusedBorderColor = ThemeBorderColor
                    )
                )

                // IGUID Input
                OutlinedTextField(
                    value = igidText,
                    onValueChange = { igidText = it.filter { c -> c.isDigit() } },
                    label = { Text("In-Game UID") },
                    placeholder = { Text("e.g. 123456789") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = AccentOrange,
                        unfocusedBorderColor = ThemeBorderColor
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (ignText.trim().isBlank()) {
                        Toast.makeText(context, "Enter your game name", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (igidText.trim().length < 6) {
                        Toast.makeText(context, "Enter a valid game UID", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    onSubmit(ignText.trim(), igidText.trim())
                },
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                enabled = ignText.isNotBlank() && igidText.isNotBlank()
            ) {
                Text("Confirm & Join", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.textButtonColors(contentColor = TextMuted)
            ) {
                Text("Cancel")
            }
        },
        containerColor = ThemeCardBg
    )
}
