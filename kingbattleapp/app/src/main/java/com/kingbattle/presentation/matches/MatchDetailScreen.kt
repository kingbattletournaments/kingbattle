package com.kingbattle.presentation.matches

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.ui.draw.alpha
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.*
import android.content.ClipData
import android.content.ClipboardManager
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.content.Context
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.R
import com.kingbattle.presentation.components.CachedNetworkImage
import com.kingbattle.presentation.components.CoinAmountRow
import com.kingbattle.presentation.components.CoinIcon
import com.kingbattle.presentation.components.rememberImageDecodeSize
import com.kingbattle.util.MatchDateTimeFormatter
import com.kingbattle.util.MatchScoringUtils
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import com.kingbattle.domain.model.Match
import com.kingbattle.domain.model.Participant
import com.kingbattle.domain.model.PrizePool
import com.kingbattle.domain.model.RankReward
import com.kingbattle.presentation.components.MatchDetailSkeleton
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
    onNavigateToSlotSelection: (matchId: String, matchTitle: String) -> Unit = { _, _ -> },
    focusRoomDetails: Boolean = false,
    viewModel: MatchDetailViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val matchDetailState = viewModel.matchDetail.collectAsState()
    val userState = viewModel.user.collectAsState()
    val isLoadingState = viewModel.isLoading.collectAsState()
    val isRefreshingState = viewModel.isRefreshing.collectAsState()
    val errorMessageState = viewModel.errorMessage.collectAsState()

    var selectedTabIndex by remember { mutableStateOf(0) }
    val tabs = listOf("DESCRIPTION", "JOINED MEMBER")
    // Reactive set of joined match IDs — read from ViewModel which uses TokenManager
    // (TokenManager writes to EncryptedSharedPreferences, so we must read from the same source)
    val joinedMatches = viewModel.joinedMatches.collectAsState()
    val joinNotifierVersion = MatchJoinNotifier.version.collectAsState()

    // Preload match details if already selected (instant UI)
    LaunchedEffect(Unit) {
        com.kingbattle.presentation.matches.SelectedMatchHolder.selectedMatch?.let {
            viewModel.preloadMatch(it)
        }
    }
    // Silently fetch participants + user data in background (won't show spinner or disrupt scroll)
    LaunchedEffect(matchId) { viewModel.fetchExtras(matchId) }

    LaunchedEffect(joinNotifierVersion.value) {
        if (joinNotifierVersion.value > 0) {
            viewModel.syncJoinedMatches()
            viewModel.fetchExtras(matchId)
        }
    }

    LaunchedEffect(focusRoomDetails, matchId) {
        if (focusRoomDetails) {
            selectedTabIndex = 0
            viewModel.refreshMatchDetail(matchId)
        }
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
                        CoinIcon(size = 14.dp)
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
            // Determine join status safely
            matchDetailState.value?.match?.let { match ->
                val isJoined = joinedMatches.value.contains(match.id) || (match.status?.equals("joined", ignoreCase = true) == true)
                val status = match.status?.lowercase() ?: ""
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ThemeDarkBg)
                        .padding(16.dp)
                ) {
                    when {
                        isJoined -> {
                            val joinPurple = Color(0xFF7C3AED)
                            Button(
                                onClick = {},
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = joinPurple.copy(alpha = 0.22f),
                                    contentColor = joinPurple.copy(alpha = 0.72f),
                                    disabledContainerColor = joinPurple.copy(alpha = 0.22f),
                                    disabledContentColor = joinPurple.copy(alpha = 0.72f),
                                ),
                                enabled = false,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("JOINED", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                        status == "upcoming" -> {
                            Button(
                                onClick = {
                                    val user = userState.value
                                    val totalCoins = (user?.coins ?: 0) + (user?.won_coins ?: 0)
                                    if (totalCoins < match.entry_fee) {
                                        Toast.makeText(context, "Insufficient coins! Please deposit first.", Toast.LENGTH_LONG).show()
                                        onNavigateToWallet()
                                    } else {
                                        SelectedMatchHolder.sourceModeId =
                                            SelectedMatchHolder.sourceModeId ?: match.game_mode_id
                                        onNavigateToSlotSelection(match.id, match.title)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth().height(48.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                                shape = RoundedCornerShape(8.dp),
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
        PullToRefreshBox(
            isRefreshing = isRefreshingState.value,
            onRefresh = { viewModel.refreshMatchDetail(matchId) },
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
        Box(
            modifier = Modifier.fillMaxSize()
        ) {
            if (isLoadingState.value && matchDetailState.value?.match == null) {
                MatchDetailSkeleton()
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
                    if (match == null) {
                        MatchDetailSkeleton()
                        return@let
                    }
                    // Determine if image is a URL or local resource
                    val isImageUrl = remember(match.image) {
                        match.image?.let { it.startsWith("http://") || it.startsWith("https://") } ?: false
                    }
                    // Fallback local drawable based on title
                    val fallbackRes = remember(match.title) {
                        when {
                            match.title.contains("duo", ignoreCase = true) -> R.drawable.duo
                            match.title.contains("squad", ignoreCase = true) -> R.drawable.squad
                            else -> R.drawable.solo
                        }
                    }
                    val bannerDecodeSize = rememberImageDecodeSize(width = 400.dp, height = 180.dp)
                    val isCompleted = remember(match.status) {
                        match.status?.trim()?.lowercase()?.let {
                            it == "completed" || it == "finished" || it == "complete" || it == "ended"
                        } ?: false
                    }

                    Column(modifier = Modifier.fillMaxSize()) {
                        // 1. Top Banner Image (16:9)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp)
                        ) {
                            if (isImageUrl) {
                                CachedNetworkImage(
                                    url = match.image.orEmpty(),
                                    contentDescription = "Match Banner",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop,
                                    decodeSize = bannerDecodeSize,
                                )
                            } else if (match.image != null) {
                                // Try local resource name
                                val localRes = remember(match.image) {
                                    val customResId = context.resources.getIdentifier(match.image, "drawable", context.packageName)
                                    if (customResId != 0) customResId else fallbackRes
                                }
                                Image(
                                    painter = painterResource(id = localRes),
                                    contentDescription = "Match Banner",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            } else {
                                // No image at all — show fallback drawable
                                Image(
                                    painter = painterResource(id = fallbackRes),
                                    contentDescription = "Match Banner",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            }
                        }

                        if (isCompleted) {
                            CompletedMatchDetailContent(
                                match = match,
                                participants = detail.participants,
                                modifier = Modifier.weight(1f),
                            )
                        } else {
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
                                // Description Tab — pass isJoined to show room code
                                val isJoined = joinedMatches.value.contains(match.id) || (match.status?.equals("joined", ignoreCase = true) == true)
                                DescriptionTabContent(match = match, isJoined = isJoined)
                            } else {
                                // Joined Member Tab
                                JoinedMemberTabContent(
                                    match = match,
                                    participants = detail.participants,
                                )
                            }
                        }
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
fun DescriptionTabContent(match: Match, isJoined: Boolean = false) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Room ID & Password card — only visible to joined users when room data is set
        val hasRoomData = !match.room_code.isNullOrBlank() || !match.room_password.isNullOrBlank()
        if (isJoined && hasRoomData) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2744)),
                border = BorderStroke(1.dp, Color(0xFF38BDF8))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "🔑 ROOM DETAILS",
                        color = Color(0xFF38BDF8),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    if (!match.room_code.isNullOrBlank()) {
                        CopyableCredentialRow(
                            label = "Room ID",
                            value = match.room_code,
                            context = context,
                        )
                    }
                    if (!match.room_password.isNullOrBlank()) {
                        CopyableCredentialRow(
                            label = "Password",
                            value = match.room_password,
                            context = context,
                        )
                    }
                }
            }
        }

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
                label = "Entry Fee",
                value = "${match.entry_fee}",
                showCoin = true,
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
            value = MatchDateTimeFormatter.format(match.starts_at),
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
                showCoin = true,
                modifier = Modifier.weight(1f)
            )
            if (MatchScoringUtils.shouldShowPerKill(match)) {
                DetailGridCard(
                    label = "Per Kill",
                    value = "${match.prizePool?.coins_per_kill ?: 10}",
                    showCoin = true,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (MatchScoringUtils.shouldShowRankRewards(match)) {
        // Rank Rewards Breakdown Section
        Text(
            text = "Rank Rewards",
            color = Color(0xFF38BDF8),
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
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                val rewards = MatchScoringUtils.visibleRankRewards(match.prizePool?.rank_rewards)
                // Header row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "RANK",
                        color = TextMuted,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "REWARD",
                        color = TextMuted,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                HorizontalDivider(
                    modifier = Modifier.fillMaxWidth(),
                    thickness = 0.5.dp,
                    color = ThemeBorderColor
                )
                rewards.forEach { reward ->
                    val rankText = if (reward.from_rank == reward.to_rank) {
                        "#${reward.from_rank}"
                    } else {
                        "#${reward.from_rank} - #${reward.to_rank}"
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = rankText,
                            color = TextWhite,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        CoinAmountRow(
                            amount = "${reward.coins}",
                            suffix = " coins",
                            coinSize = 12.dp,
                            fontSize = 13.sp,
                            color = Color(0xFF0099FF),
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
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
    modifier: Modifier = Modifier,
    showCoin: Boolean = false,
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
            if (showCoin) {
                CoinAmountRow(
                    amount = value,
                    coinSize = 12.dp,
                    fontSize = 13.sp,
                    color = TextWhite,
                    fontWeight = FontWeight.Bold,
                )
            } else {
                Text(
                    text = value,
                    color = TextWhite,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun CompletedMatchDetailContent(
    match: Match,
    participants: List<Participant>,
    modifier: Modifier = Modifier,
) {
    val sortedParticipants = remember(match, participants) {
        MatchScoringUtils.sortParticipants(participants, match)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = match.title,
            color = TextWhite,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
        )

        DetailGridCard(
            label = "Played on",
            value = MatchDateTimeFormatter.format(match.starts_at),
            modifier = Modifier.fillMaxWidth(),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DetailGridCard(
                label = "Team",
                value = match.matchType?.uppercase() ?: "SOLO",
                modifier = Modifier.weight(1f),
            )
            DetailGridCard(
                label = "Entry Fee",
                value = "${match.entry_fee}",
                showCoin = true,
                modifier = Modifier.weight(1f),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DetailGridCard(
                label = "Match Type",
                value = if (match.entry_fee > 0) "PAID" else "FREE",
                modifier = Modifier.weight(1f),
            )
            DetailGridCard(
                label = "Map",
                value = match.map ?: "BERMUDA",
                modifier = Modifier.weight(1f),
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            DetailGridCard(
                label = "Winning Prize",
                value = "${match.prizePool?.total_prize_pool ?: 0}",
                showCoin = true,
                modifier = Modifier.weight(1f),
            )
            if (MatchScoringUtils.shouldShowPerKill(match)) {
                DetailGridCard(
                    label = "Per Kill",
                    value = "${match.prizePool?.coins_per_kill ?: 0}",
                    showCoin = true,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (MatchScoringUtils.shouldShowRankRewards(match)) {
            Text(
                text = "Rank Rewards",
                color = Color(0xFF38BDF8),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
                border = BorderStroke(1.dp, ThemeBorderColor),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    MatchScoringUtils.visibleRankRewards(match.prizePool?.rank_rewards).forEach { reward ->
                        val rankText = if (reward.from_rank == reward.to_rank) {
                            "#${reward.from_rank}"
                        } else {
                            "#${reward.from_rank} - #${reward.to_rank}"
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(rankText, color = TextWhite, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            CoinAmountRow(
                                amount = "${reward.coins}",
                                suffix = " coins",
                                coinSize = 12.dp,
                                fontSize = 13.sp,
                                color = Color(0xFF0099FF),
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }

        Text(
            text = "Leaderboard",
            color = Color(0xFF38BDF8),
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
        )

        if (sortedParticipants.isEmpty()) {
            Text("No results available.", color = TextMuted, fontSize = 14.sp)
        } else {
            sortedParticipants.forEachIndexed { index, participant ->
                MatchResultRow(
                    participant = participant,
                    match = match,
                    displayRank = participant.rank ?: (index + 1),
                    showRankBadge = MatchScoringUtils.resolveScoringMode(match) != "kills_only",
                )
            }
        }
    }
}

@Composable
private fun MatchResultRow(
    participant: Participant,
    match: Match,
    displayRank: Int,
    showRankBadge: Boolean,
) {
    val playerName = participant.team_members?.firstOrNull()?.inGameName
        ?: participant.in_game_name
        ?: "Unknown Player"
    val totalKills = MatchScoringUtils.participantTotalKills(participant)
    val coinsWon = MatchScoringUtils.calcCoinsWon(participant, match.prizePool, match)
    val rankColor = when (displayRank) {
        1 -> Color(0xFFFFD700)
        2 -> Color(0xFFC0C0C0)
        3 -> Color(0xFFCD7F32)
        else -> TextMuted
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
        border = BorderStroke(0.5.dp, ThemeBorderColor),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f),
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(rankColor.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                        .border(1.dp, rankColor, RoundedCornerShape(6.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = if (showRankBadge) "#$displayRank" else "${displayRank}",
                        color = rankColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Column {
                    Text(
                        text = playerName,
                        color = TextWhite,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (totalKills > 0 && MatchScoringUtils.resolveScoringMode(match) != "rank_only") {
                        Text("$totalKills kills", color = TextMuted, fontSize = 11.sp)
                    }
                }
            }
            if (coinsWon > 0) {
                CoinAmountRow(
                    amount = "$coinsWon",
                    coinSize = 12.dp,
                    fontSize = 13.sp,
                    color = Color(0xFF0099FF),
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
fun JoinedMemberTabContent(
    match: Match,
    participants: List<Participant>,
) {
    val matchStatus = match.status
    val prizePool = match.prizePool
    val isCompleted = matchStatus?.let {
        val s = it.trim().lowercase()
        s == "completed" || s == "finished" || s == "complete" || s == "ended"
    } ?: false

    val sortedParticipants = if (isCompleted) {
        MatchScoringUtils.sortParticipants(participants, match)
    } else {
        participants
    }

    if (sortedParticipants.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No members have joined yet.", color = TextMuted, fontSize = 14.sp)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Header row when completed
            if (isCompleted) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2744)),
                        border = BorderStroke(1.dp, Color(0xFF38BDF8))
                    ) {
                        Text(
                            text = "🏆 MATCH RESULTS",
                            color = Color(0xFF38BDF8),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            itemsIndexed(sortedParticipants, key = { _, participant -> participant.id }) { index, participant ->
                val playerName = participant.team_members?.firstOrNull()?.inGameName
                    ?: participant.in_game_name
                    ?: "Unknown Player"
                val totalKills = MatchScoringUtils.participantTotalKills(participant)
                val coinsWon = if (isCompleted) {
                    MatchScoringUtils.calcCoinsWon(participant, prizePool, match)
                } else 0

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
                    border = BorderStroke(0.5.dp, ThemeBorderColor)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Left: Rank badge + name
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (isCompleted && participant.rank != null) {
                                // Rank badge
                                val rankColor = when (participant.rank) {
                                    1 -> Color(0xFFFFD700) // Gold
                                    2 -> Color(0xFFC0C0C0) // Silver
                                    3 -> Color(0xFFCD7F32) // Bronze
                                    else -> TextMuted
                                }
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .background(rankColor.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                                        .border(1.dp, rankColor, RoundedCornerShape(6.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "#${participant.rank}",
                                        color = rankColor,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            } else {
                                // Serial number for non-completed matches
                                val serialNumber = index + 1
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .background(ThemeBorderColor, RoundedCornerShape(6.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "$serialNumber",
                                        color = TextMuted,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Column {
                                Text(
                                    text = playerName,
                                    color = TextWhite,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                if (isCompleted && totalKills > 0) {
                                    Text(
                                        text = "$totalKills kills",
                                        color = TextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                        }

                        // Right: Coins won (only when completed)
                        if (isCompleted && coinsWon > 0) {
                            CoinAmountRow(
                                amount = "$coinsWon",
                                coinSize = 12.dp,
                                fontSize = 13.sp,
                                color = Color(0xFF0099FF),
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CopyableCredentialRow(
    label: String,
    value: String,
    context: Context,
) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

    fun copyValue() {
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
        Toast.makeText(context, "$label copied", Toast.LENGTH_SHORT).show()
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .clickable { copyValue() }
            .padding(vertical = 6.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = value,
                color = TextWhite,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
            Icon(
                imageVector = Icons.Filled.ContentCopy,
                contentDescription = "Copy $label",
                tint = Color(0xFF38BDF8),
                modifier = Modifier
                    .size(18.dp)
                    .clickable { copyValue() },
            )
        }
    }
}
