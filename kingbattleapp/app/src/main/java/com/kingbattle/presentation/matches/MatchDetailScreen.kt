package com.kingbattle.presentation.matches

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.R
import com.kingbattle.data.local.TokenManager
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import com.kingbattle.domain.model.Match
import com.kingbattle.domain.model.Participant
import com.kingbattle.presentation.home.AccentOrange
import com.kingbattle.presentation.home.ThemeBorderColor
import com.kingbattle.presentation.home.ThemeCardBg
import com.kingbattle.presentation.home.ThemeDarkBg
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.TextWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchDetailScreen(
    matchId: String,
    onNavigateBack: () -> Unit,
    onNavigateToWallet: () -> Unit,
    viewModel: MatchDetailViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val matchDetailState = viewModel.matchDetail.collectAsState()
    val userState = viewModel.user.collectAsState()
    val isLoadingState = viewModel.isLoading.collectAsState()
    val errorMessageState = viewModel.errorMessage.collectAsState()

    var selectedTabIndex by remember { mutableStateOf(0) }
    val tabs = listOf("DESCRIPTION", "JOINED MEMBER")

    var showJoinDialog by remember { mutableStateOf(false) }

    LaunchedEffect(matchId) {
        viewModel.loadData(matchId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = matchDetailState.value?.match?.title?.substringBefore(" - Match") ?: "MATCH DETAILS",
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
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ThemeDarkBg)
            )
        },
        bottomBar = {
            matchDetailState.value?.match?.let { match ->
                val localJoined = viewModel.matchDetail.value?.match?.id?.let {
                    // Check local or remote joined status
                    val prefs = context.getSharedPreferences("king_battle_prefs", android.content.Context.MODE_PRIVATE)
                    val localList = prefs.getStringSet("joined_matches", emptySet()) ?: emptySet()
                    localList.contains(it)
                } ?: false

                val isJoined = localJoined || match.status.equals("joined", ignoreCase = true)
                val status = match.status.lowercase()

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ThemeDarkBg)
                        .padding(16.dp)
                ) {
                    when {
                        isJoined -> {
                            Button(
                                onClick = {},
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                enabled = false,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("JOINED", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                        status == "upcoming" -> {
                            Button(
                                onClick = {
                                    val userCoins = userState.value?.coins ?: 0
                                    if (userCoins < match.entry_fee) {
                                        Toast.makeText(context, "Insufficient coins! Please deposit first.", Toast.LENGTH_LONG).show()
                                        onNavigateToWallet()
                                    } else {
                                        showJoinDialog = true
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("JOIN MATCH", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                        status == "ongoing" -> {
                            Button(
                                onClick = {},
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = ThemeBorderColor),
                                enabled = false,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("MATCH ONGOING", color = TextMuted, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                        else -> {
                            Button(
                                onClick = {},
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = ThemeBorderColor),
                                enabled = false,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("MATCH COMPLETED", color = TextMuted, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }
            }
        },
        containerColor = ThemeDarkBg
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (isLoadingState.value) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = AccentOrange
                )
            } else if (errorMessageState.value != null) {
                Text(
                    text = errorMessageState.value ?: "An error occurred",
                    color = Color.Red,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp)
                )
            } else {
                matchDetailState.value?.let { detail ->
                    val match = detail.match
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

                    Column(modifier = Modifier.fillMaxSize()) {
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

                        // 2. Tab Row
                        TabRow(
                            selectedTabIndex = selectedTabIndex,
                            containerColor = ThemeCardBg,
                            contentColor = Color.White,
                            indicator = { tabPositions ->
                                TabRowDefaults.SecondaryIndicator(
                                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                                    color = AccentOrange
                                )
                            }
                        ) {
                            tabs.forEachIndexed { index, title ->
                                Tab(
                                    selected = selectedTabIndex == index,
                                    onClick = { selectedTabIndex = index },
                                    text = {
                                        Text(
                                            text = title,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            letterSpacing = 1.sp
                                        )
                                    },
                                    selectedContentColor = Color.White,
                                    unselectedContentColor = TextMuted
                                )
                            }
                        }

                        // 3. Tab Content
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f)
                        ) {
                            if (selectedTabIndex == 0) {
                                // Description Tab
                                DescriptionTabContent(match = match)
                            } else {
                                // Joined Member Tab
                                JoinedMemberTabContent(participants = detail.participants)
                            }
                        }
                    }
                }
            }
        }
    }

    // Join Match Input Dialog
    if (showJoinDialog && matchDetailState.value != null) {
        val match = matchDetailState.value!!.match
        JoinMatchDialog(
            entryFee = match.entry_fee,
            savedName = userState.value?.in_game_name ?: "",
            savedUid = userState.value?.in_game_uid ?: "",
            onDismiss = { showJoinDialog = false },
            onSubmit = { ign, igid ->
                showJoinDialog = false
                viewModel.joinMatch(
                    matchId = match.id,
                    inGameName = ign,
                    inGameUid = igid,
                    onSuccess = {
                        Toast.makeText(context, "Successfully joined tournament!", Toast.LENGTH_LONG).show()
                    },
                    onError = { err ->
                        Toast.makeText(context, "Failed: $err", Toast.LENGTH_LONG).show()
                    }
                )
            }
        )
    }
}

@Composable
fun DescriptionTabContent(match: Match) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Title block
        Text(
            text = match.title,
            color = TextWhite,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold
        )

        // Details Grid Row 1
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DetailGridCard(
                label = "Team",
                value = match.matchType?.uppercase() ?: "SOLO",
                modifier = Modifier.weight(1f)
            )
            DetailGridCard(
                label = "Entry Fee 🪙",
                value = "${match.entry_fee}",
                modifier = Modifier.weight(1f)
            )
        }

        // Details Grid Row 2
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DetailGridCard(
                label = "Match Type",
                value = if (match.entry_fee > 0) "PAID" else "FREE",
                modifier = Modifier.weight(1f)
            )
            DetailGridCard(
                label = "Map",
                value = match.map ?: "BERMUDA",
                modifier = Modifier.weight(1f)
            )
        }

        // Details Grid Row 3
        DetailGridCard(
            label = "Match Schedule",
            value = match.starts_at,
            modifier = Modifier.fillMaxWidth()
        )

        // Price Details Section
        Text(
            text = "Price Details",
            color = Color(0xFF38BDF8), // Light sky-blue
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DetailGridCard(
                label = "Winning Prize",
                value = "${match.prizePool?.total_prize_pool ?: 500}",
                modifier = Modifier.weight(1f)
            )
            DetailGridCard(
                label = "Per Kill",
                value = "${match.prizePool?.coins_per_kill ?: 10}",
                modifier = Modifier.weight(1f)
            )
        }

        // About this Match Section
        Text(
            text = "About this Match",
            color = Color(0xFF38BDF8), // Light sky-blue
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(8.dp),
            colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
            border = BorderStroke(1.dp, ThemeBorderColor)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "FULL MAP RULES",
                    color = TextWhite,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "Minimum 30 level players are allowed to participate in King Battle matches, if low-level players found they will be kicked immediately from the match.\n\n" +
                            "Unregistered Players are not allowed, inviting unregistered players leads to Penalty or No rewards.\n\n" +
                            "Record Your Gameplay, You can Be Asked To Provide POV/ Recordings.",
                    color = TextMuted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
            }
        }
    }
}

@Composable
fun DetailGridCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
        border = BorderStroke(1.dp, ThemeBorderColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp, horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = label,
                color = TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = value,
                color = TextWhite,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun JoinedMemberTabContent(participants: List<Participant>) {
    if (participants.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No members have joined yet.", color = TextMuted, fontSize = 14.sp)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            itemsIndexed(participants) { index, participant ->
                Column(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${index + 1}. ",
                            color = TextMuted,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.width(36.dp)
                        )
                        Text(
                            text = participant.in_game_name ?: "Unknown Player",
                            color = TextWhite,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    HorizontalDivider(
                        modifier = Modifier.fillMaxWidth(),
                        thickness = 0.5.dp,
                        color = ThemeBorderColor
                    )
                }
            }
        }
    }
}
