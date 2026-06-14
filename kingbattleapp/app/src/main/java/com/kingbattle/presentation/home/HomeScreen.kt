package com.kingbattle.presentation.home

import android.widget.Toast
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kingbattle.domain.model.GameMode
import com.kingbattle.domain.model.LeaderboardUser
import com.kingbattle.presentation.auth.AuthViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState

// Color Palette for Premium Pitch Black & Green Theme
val ThemeDarkBg = Color(0xFF000000)      // Pitch black background
val ThemeCardBg = Color(0xFF121212)      // Very dark grey card background
val ThemeBorderColor = Color(0xFF1C1C1E)  // Dark border color
val ThemeFooterBg = Color(0xFF000000)    // Pitch black footer for mode cards
val AccentOrange = Color(0xFF22C55E)     // Vibrant green accent
val AccentGold = Color(0xFFFFB000)       // Gold color for coins
val TextWhite = Color(0xFFF8FAFC)        // Slate-50 main text
val TextMuted = Color(0xFF94A3B8)        // Slate-400 secondary text

// Custom ImageVectors for navbar icons (since SportsEsports and Leaderboard are not in the core Material icons library)
val SportsEsportsIcon: ImageVector
    get() = ImageVector.Builder(
        name = "SportsEsports",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 122.88f,
        viewportHeight = 95.16f
    ).path(
        fill = SolidColor(Color.White)
    ) {
        moveTo(49f, 49.58f)
        lineToRelative(-3.63f, 3.63f)
        verticalLineTo(46f)
        lineTo(49f, 49.58f)
        close()

        moveTo(104.47f, 21.23f)
        horizontalLineTo(104.74f)
        arcToRelative(2.51f, 2.51f, 0f, false, true, 1.93f, 0.91f)
        curveTo(118f, 33.88f, 124f, 59.37f, 122.7f, 76.43f)
        arcToRelative(34.17f, 34.17f, 0f, false, true, -2.83f, 12f)
        curveToRelative(-1.74f, 3.58f, -4.25f, 5.93f, -7.61f, 6.55f)
        curveToRelative(-4.28f, 0.79f, -9.63f, -1.47f, -16.06f, -8f)
        curveToRelative(-0.83f, -0.84f, -1.69f, -1.69f, -2.57f, -2.56f)
        arcToRelative(74.51f, 74.51f, 0f, false, true, -8.83f, -9.81f)
        horizontalLineTo(38.08f)
        arcToRelative(73.06f, 73.06f, 0f, false, true, -8.85f, 9.84f)
        curveToRelative(-0.87f, 0.86f, -1.73f, 1.7f, -2.55f, 2.53f)
        curveToRelative(-6.43f, 6.55f, -11.78f, 8.81f, -16.06f, 8f)
        curveToRelative(-3.36f, -0.62f, -5.88f, -3f, -7.62f, -6.57f)
        arcToRelative(34.22f, 34.22f, 0f, false, true, -2.83f, -12f)
        curveTo(-1.15f, 59.29f, 4.9f, 33.65f, 16.4f, 22f)
        arcToRelative(2.48f, 2.48f, 0f, false, true, 1.78f, -0.75f)
        horizontalLineTo(18.46f)
        curveToRelative(7.09f, -9.76f, 23f, -9.86f, 30.09f, 0f)
        horizontalLineToRelative(7.91f)
        curveTo(55.85f, 6.29f, 60f, 2.54f, 66.13f, 2.12f)
        arcToRelative(31.1f, 31.1f, 0f, false, true, 7f, 0.65f)
        curveToRelative(4.65f, 0.77f, 9.8f, 1.62f, 13.45f, -2f)
        arcToRelative(2.48f, 2.48f, 0f, false, true, 3.54f, 0f)
        arcToRelative(2.5f, 2.5f, 0f, false, true, 0f, 3.54f)
        curveToRelative(-5.47f, 5.46f, -12f, 4.39f, -17.8f, 3.42f)
        arcToRelative(27.84f, 27.84f, 0f, false, false, -5.89f, -0.59f)
        curveToRelative(-3.31f, 0.22f, -5.51f, 3f, -5f, 14.12f)
        horizontalLineTo(74.34f)
        curveToRelative(7.07f, -9.79f, 23f, -9.82f, 30.09f, 0f)
        close()

        moveTo(39.19f, 37f)
        verticalLineToRelative(6.66f)
        horizontalLineToRelative(6.66f)
        curveToRelative(7.54f, 0f, 7.54f, 11.4f, 0f, 11.4f)
        horizontalLineTo(39.19f)
        verticalLineToRelative(6.66f)
        curveToRelative(0f, 7.54f, -11.4f, 7.54f, -11.4f, 0f)
        verticalLineTo(55.07f)
        horizontalLineTo(21.13f)
        curveToRelative(-7.54f, 0f, -7.54f, -11.4f, 0f, -11.4f)
        horizontalLineToRelative(6.66f)
        verticalLineTo(37f)
        curveToRelative(0f, -7.54f, 11.4f, -7.54f, 11.4f, 0f)
        close()

        moveTo(91.27f, 31.2f)
        arcToRelative(5.26f, 5.26f, 0f, true, true, -7.44f, 0f)
        arcToRelative(5.25f, 5.25f, 0f, false, true, 7.44f, 0f)
        close()

        moveTo(91.27f, 54.14f)
        arcToRelative(5.26f, 5.26f, 0f, true, true, -7.44f, 0f)
        arcToRelative(5.25f, 5.25f, 0f, false, true, 7.44f, 0f)
        close()

        moveTo(103.89f, 42.14f)
        arcToRelative(5.26f, 5.26f, 0f, true, true, -7.44f, 0f)
        arcToRelative(5.27f, 5.27f, 0f, false, true, 7.44f, 0f)
        close()

        moveTo(78.64f, 42.14f)
        arcToRelative(5.26f, 5.26f, 0f, true, true, -7.44f, 0f)
        arcToRelative(5.25f, 5.25f, 0f, false, true, 7.44f, 0f)
        close()

        moveTo(33.64f, 34.26f)
        lineToRelative(3.63f, 3.63f)
        horizontalLineTo(30.05f)
        lineToRelative(3.63f, -3.63f)
        close()

        moveTo(18.39f, 49.58f)
        lineTo(22f, 53.21f)
        verticalLineTo(46f)
        lineToRelative(-3.63f, 3.63f)
        close()

        moveTo(33.68f, 64.86f)
        lineToRelative(3.63f, -3.63f)
        horizontalLineTo(30.05f)
        lineToRelative(3.63f, 3.63f)
        close()
    }.build()

val EarnIcon: ImageVector
    get() = ImageVector.Builder(
        name = "Earn",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(
        fill = SolidColor(Color.White)
    ) {
        moveTo(20.0f, 6.0f)
        horizontalLineToRelative(-2.18f)
        curveToRelative(0.11f, -0.31f, 0.18f, -0.65f, 0.18f, -1.0f)
        curveToRelative(0.0f, -1.66f, -1.34f, -3.0f, -3.0f, -3.0f)
        curveToRelative(-1.05f, 0.0f, -1.96f, 0.54f, -2.5f, 1.35f)
        curveToRelative(-0.54f, -0.81f, -1.45f, -1.35f, -2.5f, -1.35f)
        curveToRelative(-1.66f, 0.0f, -3.0f, 1.34f, -3.0f, 3.0f)
        curveToRelative(0.0f, 0.35f, 0.07f, 0.69f, 0.18f, 1.0f)
        horizontalLineTo(4.0f)
        curveToRelative(-1.1f, 0.0f, -1.99f, 0.9f, -1.99f, 2.0f)
        verticalLineToRelative(3.0f)
        curveToRelative(0.0f, 0.75f, 0.4f, 1.4f, 1.0f, 1.76f)
        verticalLineTo(19.0f)
        curveToRelative(0.0f, 1.1f, 0.9f, 2.0f, 2.0f, 2.0f)
        horizontalLineToRelative(14.0f)
        curveToRelative(1.1f, 0.0f, 2.0f, -0.9f, 2.0f, -2.0f)
        verticalLineToRelative(-6.24f)
        curveToRelative(0.6f, -0.36f, 1.0f, -1.01f, 1.0f, -1.76f)
        verticalLineTo(8.0f)
        curveToRelative(0.0f, -1.1f, -0.9f, -2.0f, -2.0f, -2.0f)
        close()
        moveTo(15.0f, 4.0f)
        curveToRelative(0.55f, 0.0f, 1.0f, 0.45f, 1.0f, 1.0f)
        reflectiveCurveToRelative(-0.45f, 1.0f, -1.0f, 1.0f)
        horizontalLineToRelative(-2.0f)
        curveToRelative(0.0f, -0.55f, 0.45f, -1.0f, 1.0f, -1.0f)
        close()
        moveTo(9.0f, 5.0f)
        curveToRelative(0.0f, -0.55f, 0.45f, -1.0f, 1.0f, -1.0f)
        reflectiveCurveToRelative(1.0f, 0.45f, 1.0f, 1.0f)
        verticalLineToRelative(1.0f)
        horizontalLineTo(9.0f)
        verticalLineTo(5.0f)
        close()
        moveTo(4.0f, 8.0f)
        horizontalLineToRelative(7.0f)
        verticalLineToRelative(3.0f)
        horizontalLineTo(4.0f)
        verticalLineTo(8.0f)
        close()
        moveTo(6.0f, 19.0f)
        verticalLineToRelative(-6.0f)
        horizontalLineToRelative(5.0f)
        verticalLineToRelative(6.0f)
        horizontalLineTo(6.0f)
        close()
        moveTo(18.0f, 19.0f)
        horizontalLineToRelative(-5.0f)
        verticalLineToRelative(-6.0f)
        horizontalLineToRelative(5.0f)
        verticalLineToRelative(6.0f)
        close()
        moveTo(20.0f, 11.0f)
        horizontalLineToRelative(-7.0f)
        verticalLineTo(8.0f)
        horizontalLineToRelative(7.0f)
        verticalLineTo(11.0f)
        close()
    }.build()

enum class HomeTab {
    EARN, PLAY, ACCOUNT
}

@Composable
fun HomeScreen(
    onLogout: () -> Unit,
    onNavigateToMatches: (String, Int) -> Unit,
    onNavigateToWallet: () -> Unit,
    authViewModel: AuthViewModel = hiltViewModel(),
    homeViewModel: HomeViewModel = hiltViewModel()
) {
    var activeTab by remember { mutableStateOf(HomeTab.PLAY) }
    var showReferScreen by remember { mutableStateOf(false) }
    var showLeaderboard by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val userState = homeViewModel.user.collectAsState()
    val announcementState = homeViewModel.announcementText.collectAsState()
    val bannersState = homeViewModel.banners.collectAsState()
    val modesState = homeViewModel.modes.collectAsState()
    val isLoadingState = homeViewModel.isLoading.collectAsState()
    val errorState = homeViewModel.errorMessage.collectAsState()
    val supportUrlState = homeViewModel.supportUrl.collectAsState()

    // Trigger loadData when activeTab is selected to refresh values
    LaunchedEffect(activeTab) {
        homeViewModel.loadData()
    }

    if (showReferScreen) {
        ReferScreen(
            user = userState.value,
            referralSettings = homeViewModel.referralSettings.collectAsState().value,
            onBack = { showReferScreen = false }
        )
    } else if (showLeaderboard) {
        LeaderboardScreen(
            leaderboard = homeViewModel.leaderboard.collectAsState().value,
            isLoading = homeViewModel.isLoading.collectAsState().value,
            errorMessage = homeViewModel.errorMessage.collectAsState().value,
            onBack = { showLeaderboard = false },
            onRetry = { homeViewModel.loadData() }
        )
    } else {
        Scaffold(
            bottomBar = {
                BottomNavigationBar(
                    activeTab = activeTab,
                    onTabSelected = { activeTab = it }
                )
            },
            containerColor = ThemeDarkBg
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when (activeTab) {
                    HomeTab.PLAY -> {
                        PlayTabContent(
                            user = userState.value,
                            announcementText = announcementState.value,
                            banners = bannersState.value,
                            modes = modesState.value,
                            isLoading = isLoadingState.value,
                            errorMessage = errorState.value,
                            onModeClick = { modeId -> onNavigateToMatches(modeId, 1) },
                            onNavigateToMatches = onNavigateToMatches,
                            onRetry = { homeViewModel.loadData() },
                            onBalanceClick = onNavigateToWallet
                        )
                    }
                    HomeTab.EARN -> {
                        EarnTabContent(
                            banners = bannersState.value,
                            isLoading = isLoadingState.value,
                            errorMessage = errorState.value,
                            onRetry = { homeViewModel.loadData() },
                            onReferClick = { showReferScreen = true }
                        )
                    }
                    HomeTab.ACCOUNT -> {
                        AccountTabContent(
                            user = userState.value,
                            supportUrl = supportUrlState.value,
                            onLogoutClick = {
                                authViewModel.logout()
                                onLogout()
                            },
                            onWalletClick = onNavigateToWallet,
                            onLeaderboardClick = { showLeaderboard = true }
                        )
                    }
                }
            }
        }
    }
}

// ==================== PLAY TAB CONTENT ====================
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PlayTabContent(
    user: com.kingbattle.domain.model.User?,
    announcementText: String,
    banners: List<com.kingbattle.domain.model.AppBanner>,
    modes: List<GameMode>,
    isLoading: Boolean,
    errorMessage: String?,
    onModeClick: (String) -> Unit,
    onNavigateToMatches: (String, Int) -> Unit,
    onRetry: () -> Unit,
    onBalanceClick: () -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Sticky Header: stays fixed at the top
        HeaderSection(user = user, onBalanceClick = onBalanceClick)

        // Sticky Announcement Bar: stays fixed below the header
        if (announcementText.isNotBlank()) {
            AnnouncementSection(text = announcementText)
        }

        // Scrollable Body
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Banner Carousel Section
            BannerSection()

            // My Matches Section
            MyMatchesSection(onNavigateToMatches = onNavigateToMatches)

            // Available Modes Grid Title
            Text(
                text = "AVAILABLE MODES",
                color = TextWhite,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            // Available Modes Content
            when {
                isLoading && modes.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(150.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = AccentOrange)
                    }
                }
                errorMessage != null && modes.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = errorMessage,
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                        Button(
                            onClick = onRetry,
                            colors = ButtonDefaults.buttonColors(containerColor = AccentOrange)
                        ) {
                            Text("Retry")
                        }
                    }
                }
                modes.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "No active game modes available.",
                            color = TextMuted,
                            fontSize = 14.sp
                        )
                    }
                }
                else -> {
                    ModesGrid(modes = modes, onModeClick = onModeClick)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

// ==================== HEADER SECTION ====================
@Composable
fun HeaderSection(user: com.kingbattle.domain.model.User?, onBalanceClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(ThemeDarkBg)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        // Left Side: App Logo
        Image(
            painter = androidx.compose.ui.res.painterResource(id = com.kingbattle.R.drawable.app_logo),
            contentDescription = "King Battle App Logo",
            modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .border(1.dp, ThemeBorderColor, CircleShape)
                .align(Alignment.CenterStart),
            contentScale = ContentScale.Crop
        )

        // Middle: Welcome text (Absolute center of screen)
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "WELCOME TO",
                color = TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center
            )
            Text(
                text = "KING BATTLE",
                color = TextWhite,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                textAlign = TextAlign.Center
            )
        }

        // Right Side: Coin Balance pill
        val formattedCoins = String.format("%.2f", user?.coins?.toDouble() ?: 0.0)
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(ThemeCardBg)
                .border(1.dp, ThemeBorderColor, RoundedCornerShape(50))
                .clickable { onBalanceClick() }
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .align(Alignment.CenterEnd),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "💵", // 2D Green Cash Bundle Emoji/Icon
                fontSize = 16.sp
            )
            Text(
                text = formattedCoins,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// ==================== ANNOUNCEMENT SECTION ====================
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AnnouncementSection(text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(38.dp)
            .background(Color(0xFF000000))
            .border(width = 1.dp, color = ThemeBorderColor.copy(alpha = 0.5f)),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Megaphone Icon on Orange Background
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .background(AccentOrange)
                .padding(horizontal = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.Notifications,
                contentDescription = "Announcement",
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
        }

        // Marquee Text with Dark Background
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(ThemeCardBg)
                .padding(horizontal = 12.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = text,
                color = AccentGold,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                modifier = Modifier.basicMarquee(
                    iterations = Int.MAX_VALUE,
                    velocity = 40.dp
                )
            )
        }
    }
}

// ==================== BANNER SECTION ====================
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BannerSection() {
    val localBanners = listOf(
        com.kingbattle.R.drawable.banner_image,
        com.kingbattle.R.drawable.refer_banner
    )
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
        border = BorderStroke(1.dp, ThemeBorderColor)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            val pagerState = rememberPagerState(pageCount = { localBanners.size })
            
            LaunchedEffect(Unit) {
                while (true) {
                    kotlinx.coroutines.delay(5000)
                    val nextPage = (pagerState.currentPage + 1) % localBanners.size
                    pagerState.animateScrollToPage(nextPage)
                }
            }

            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize()
            ) { page ->
                Image(
                    painter = androidx.compose.ui.res.painterResource(id = localBanners[page]),
                    contentDescription = "App Home Banner",
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }

            if (localBanners.size > 1) {
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    repeat(localBanners.size) { index ->
                        val isSelected = pagerState.currentPage == index
                        Box(
                            modifier = Modifier
                                .size(if (isSelected) 8.dp else 6.dp)
                                .clip(CircleShape)
                                .background(if (isSelected) AccentOrange else Color.White.copy(alpha = 0.5f))
                        )
                    }
                }
            }
        }
    }
}

// ==================== MY MATCHES SECTION ====================
@Composable
fun MyMatchesSection(onNavigateToMatches: (String, Int) -> Unit) {
    val context = LocalContext.current
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "MY MATCHES",
            color = TextWhite,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val sections = listOf(
                Triple("Ongoing", com.kingbattle.R.drawable.ongoing, 0),
                Triple("Upcoming", com.kingbattle.R.drawable.upcoming, 1),
                Triple("Completed", com.kingbattle.R.drawable.completed, 2)
            )

            sections.forEach { (title, drawableRes, tabIndex) ->
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            onNavigateToMatches("my_matches", tabIndex)
                        },
                    colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
                    border = BorderStroke(1.dp, ThemeBorderColor),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp, horizontal = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Image(
                            painter = androidx.compose.ui.res.painterResource(id = drawableRes),
                            contentDescription = title,
                            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Fit
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = title.uppercase(),
                            color = TextWhite,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
}

// ==================== MODES GRID ====================
@Composable
fun ModesGrid(
    modes: List<GameMode>,
    onModeClick: (String) -> Unit
) {
    val itemsPerRow = 3
    val rows = (modes.size + itemsPerRow - 1) / itemsPerRow

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        for (rowIndex in 0 until rows) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                for (colIndex in 0 until itemsPerRow) {
                    val modeIndex = rowIndex * itemsPerRow + colIndex
                    if (modeIndex < modes.size) {
                        val mode = modes[modeIndex]
                        ModeCardItem(
                            mode = mode,
                            onClick = { onModeClick(mode.id) },
                            modifier = Modifier.weight(1f)
                        )
                    } else {
                        // Empty spacer to maintain layout alignment
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
fun ModeCardItem(
    mode: GameMode,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .aspectRatio(0.85f)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
        border = BorderStroke(1.dp, ThemeBorderColor)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Upper Area: Image/Avatar
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                val localResId = when (mode.name.uppercase()) {
                    "SOLO" -> com.kingbattle.R.drawable.solo
                    "DUO" -> com.kingbattle.R.drawable.duo
                    "SQUAD" -> com.kingbattle.R.drawable.squad
                    else -> null
                }
                if (localResId != null) {
                    Image(
                        painter = androidx.compose.ui.res.painterResource(id = localResId),
                        contentDescription = mode.name,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else if (!mode.image_url.isNullOrBlank()) {
                    AsyncImage(
                        url = mode.image_url,
                        contentDescription = mode.name,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Text(
                        text = mode.name.firstOrNull()?.toString()?.uppercase() ?: "M",
                        color = AccentOrange,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Lower Area: Dark blue footer with Mode name
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(30.dp)
                    .background(ThemeFooterBg),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = mode.name,
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(horizontal = 4.dp),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

// ==================== EARN TAB CONTENT ====================
@Composable
fun EarnTabContent(
    banners: List<com.kingbattle.domain.model.AppBanner>,
    isLoading: Boolean,
    errorMessage: String?,
    onRetry: () -> Unit,
    onReferClick: () -> Unit
) {
    val context = LocalContext.current
    val earnBanners = remember(banners) {
        banners.filter { it.displayEarn }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "EARN REWARDS",
            color = TextWhite,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 4.dp)
        )
        Text(
            text = "Complete offers and refer friends to earn coins",
            color = TextMuted,
            fontSize = 12.sp,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // 1. Referral Banner at the top of Earn Tab (redirects to the Refer page)
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onReferClick() }
                        .border(1.dp, ThemeBorderColor, RoundedCornerShape(12.dp)),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = ThemeCardBg)
                ) {
                    Image(
                        painter = androidx.compose.ui.res.painterResource(id = com.kingbattle.R.drawable.refer_banner),
                        contentDescription = "Refer & Earn Banner",
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(16f / 9f),
                        contentScale = ContentScale.Crop
                    )
                }
            }

            // 2. Dynamic Earn Banners (remote from server)
            itemsIndexed(earnBanners) { _, banner ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            val url = banner.linkUrl
                            if (url.isNotBlank()) {
                                try {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Could not open link", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                        .border(1.dp, ThemeBorderColor, RoundedCornerShape(12.dp)),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = ThemeCardBg)
                ) {
                    val imageUrl = banner.imageUrl
                    if (imageUrl.startsWith("local://") || imageUrl == "local_banner" || imageUrl.contains("unsplash") || imageUrl.isBlank()) {
                        Image(
                            painter = androidx.compose.ui.res.painterResource(id = com.kingbattle.R.drawable.banner_image),
                            contentDescription = "Earn Offer Banner",
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        AsyncImage(
                            url = imageUrl,
                            contentDescription = "Earn Offer Banner",
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(16f / 9f),
                            contentScale = ContentScale.Crop
                        )
                    }
                }
            }
        }
    }
}

// ==================== ACCOUNT TAB CONTENT ====================
@Composable
fun AccountTabContent(
    user: com.kingbattle.domain.model.User?,
    supportUrl: String,
    onLogoutClick: () -> Unit,
    onWalletClick: () -> Unit,
    onLeaderboardClick: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val scrollState = rememberScrollState()

    var showAboutDialog by remember { mutableStateOf(false) }
    var showTermsDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThemeDarkBg) // Screen dark background
    ) {
        // Top Dark Header background (covers top 120.dp)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .background(ThemeDarkBg)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Spacer/Offset for avatar positioning over the header boundary
            Spacer(modifier = Modifier.height(60.dp))

            // Centered Circular Avatar
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(ThemeCardBg)
                    .border(2.dp, ThemeBorderColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(2.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFF15803D), Color(0xFF22C55E), Color(0xFF4ADE80)) // Beautiful green gradient
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = user?.display_name?.firstOrNull()?.toString()?.uppercase() ?: "?",
                        color = Color.White,
                        fontSize = 44.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Username text below avatar
            Text(
                text = user?.display_name ?: "subasit",
                color = TextWhite,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            if (!user?.username.isNullOrBlank()) {
                Row(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 16.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(ThemeCardBg)
                        .border(1.dp, ThemeBorderColor, RoundedCornerShape(8.dp))
                        .clickable {
                            clipboardManager.setText(AnnotatedString(user.username))
                            Toast.makeText(context, "Referral code copied!", Toast.LENGTH_SHORT).show()
                        }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Referral Code: ${user.username}",
                        color = AccentOrange,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "📋",
                        fontSize = 14.sp
                    )
                }
            }

            // Stats Dashboard Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .border(1.dp, ThemeBorderColor, RoundedCornerShape(8.dp)),
                shape = RoundedCornerShape(8.dp),
                colors = CardDefaults.cardColors(containerColor = ThemeCardBg), // Dark theme card background
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp, horizontal = 8.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Matches Played
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = "${user?.matches_played ?: 0}",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Matches",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Played",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // Vertical Divider
                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(45.dp)
                            .background(ThemeBorderColor)
                    )

                    // Total Killed
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = "${user?.total_kills ?: 0}",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Total",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Killed",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // Vertical Divider
                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(45.dp)
                            .background(ThemeBorderColor)
                    )

                    // Amount Won
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.weight(1f)
                    ) {
                        Row(
                          verticalAlignment = Alignment.CenterVertically,
                          horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(text = "💵", fontSize = 18.sp)
                            Text(
                                text = "${user?.lifetime_earned_points ?: 0}",
                                color = AccentGold,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Amount",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Won",
                            color = Color.White.copy(alpha = 0.8f),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Menu Options (Individual dark cards exactly like reference UI but themed)
            val menuItems = listOf(
                Triple("My Wallet", "👛", onWalletClick),
                Triple("Leaderboard", "🏆", onLeaderboardClick),
                Triple("My Matches", "🎮", {
                    Toast.makeText(context, "View matches under Play tab!", Toast.LENGTH_SHORT).show()
                }),
                Triple("Customer Support", "💬", {
                    val url = if (supportUrl.isNotBlank()) supportUrl else "https://kingbattle.com/support"
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(context, "Could not open support link", Toast.LENGTH_SHORT).show()
                    }
                }),
                Triple("About Us", "ℹ️", { showAboutDialog = true }),
                Triple("Terms & Conditions", "📜", { showTermsDialog = true }),
                Triple("Share App", "📢", {
                    try {
                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, "King Battle App")
                            putExtra(Intent.EXTRA_TEXT, "Hey! Join daily Free Fire tournaments on King Battle and win real coins! Download now: https://kingbattle.com")
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share App via"))
                    } catch (e: Exception) {
                        Toast.makeText(context, "Could not share app", Toast.LENGTH_SHORT).show()
                    }
                }),
                Triple("Logout", "🚪", onLogoutClick)
            )

            menuItems.forEach { (label, emoji, action) ->
                val isLogout = label == "Logout"
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .clickable { action() }
                        .border(1.dp, ThemeBorderColor, RoundedCornerShape(8.dp)),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Text(
                                text = emoji,
                                fontSize = 20.sp
                            )
                            Text(
                                text = label,
                                color = if (isLogout) Color(0xFFDC2626) else TextWhite,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = "➔",
                            color = if (isLogout) Color(0xFFDC2626).copy(alpha = 0.5f) else TextMuted,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }



    // ==================== ABOUT US DIALOG ====================
    if (showAboutDialog) {
        AlertDialog(
            onDismissRequest = { showAboutDialog = false },
            title = {
                Text(
                    text = "About King Battle",
                    color = TextWhite,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "Welcome to King Battle!\n\nThe ultimate destination for Free Fire tournaments. Compete in Solo, Duo, or Squad tournaments daily, score kills, rise on the podium, and win real rewards.\n\nVersion: 1.0.0",
                    color = TextMuted,
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                TextButton(onClick = { showAboutDialog = false }) {
                    Text("Close", color = AccentOrange)
                }
            },
            containerColor = ThemeCardBg,
            shape = RoundedCornerShape(16.dp)
        )
    }

    // ==================== TERMS & CONDITIONS DIALOG ====================
    if (showTermsDialog) {
        AlertDialog(
            onDismissRequest = { showTermsDialog = false },
            title = {
                Text(
                    text = "Terms & Conditions",
                    color = TextWhite,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "1. Only Free Fire tournaments are held.",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                    Text(
                        text = "2. Cheating or hacking is strictly prohibited. Violators will be permanently blocked and forfeit their coins.",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                    Text(
                        text = "3. Winnings withdrawals are processed securely by admin approval.",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                    Text(
                        text = "4. By participating, you agree to respect community sportsmanship.",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showTermsDialog = false }) {
                    Text("Accept & Close", color = AccentOrange)
                }
            },
            containerColor = ThemeCardBg,
            shape = RoundedCornerShape(16.dp)
        )
    }
}

// ==================== BOTTOM NAVIGATION BAR ====================
@Composable
fun BottomNavigationBar(
    activeTab: HomeTab,
    onTabSelected: (HomeTab) -> Unit
) {
    NavigationBar(
        containerColor = ThemeFooterBg,
        tonalElevation = 8.dp,
        modifier = Modifier.border(width = 1.dp, color = ThemeBorderColor, shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
    ) {
        val items = listOf(
            Triple(HomeTab.EARN, "Earn", EarnIcon),
            Triple(HomeTab.PLAY, "Play", SportsEsportsIcon),
            Triple(HomeTab.ACCOUNT, "Account", Icons.Filled.Person)
        )

        items.forEach { (tab, label, icon) ->
            NavigationBarItem(
                selected = activeTab == tab,
                onClick = { onTabSelected(tab) },
                icon = {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (activeTab == tab) AccentOrange else TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                },
                label = {
                    Text(
                        text = label,
                        color = if (activeTab == tab) AccentOrange else TextMuted,
                        fontSize = 11.sp,
                        fontWeight = if (activeTab == tab) FontWeight.Bold else FontWeight.Medium
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    indicatorColor = Color.Transparent
                )
            )
        }
    }
}

// ==================== CUSTOM ASYNC IMAGE LOADER ====================
@Composable
fun AsyncImage(
    url: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop
) {
    var imageBitmap by remember(url) {
        mutableStateOf<androidx.compose.ui.graphics.ImageBitmap?>(null)
    }
    var isLoading by remember(url) {
        mutableStateOf(true)
    }

    LaunchedEffect(url) {
        if (url.isBlank()) {
            isLoading = false
            return@LaunchedEffect
        }
        isLoading = true
        withContext(Dispatchers.IO) {
            try {
                val client = OkHttpClient()
                val request = Request.Builder().url(url).build()
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val bytes = response.body?.bytes()
                        if (bytes != null) {
                            val bitmap = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                            if (bitmap != null) {
                                imageBitmap = bitmap.asImageBitmap()
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        val bitmap = imageBitmap
        if (bitmap != null) {
            Image(
                bitmap = bitmap,
                contentDescription = contentDescription,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale
            )
        } else if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(ThemeCardBg),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    color = AccentOrange,
                    modifier = Modifier.size(24.dp)
                )
            }
        } else {
            // Fallback placeholder card
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(ThemeCardBg),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "KING BATTLE",
                    color = TextMuted.copy(alpha = 0.3f),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        }
    }
}

// ==================== REFER SCREEN (DEDICATED PAGE) ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferScreen(
    user: com.kingbattle.domain.model.User?,
    referralSettings: com.kingbattle.domain.model.ReferralSettings?,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val scrollState = rememberScrollState()

    val rewardCoins = referralSettings?.rewardCoins ?: 5
    val signupBonus = referralSettings?.signupBonus ?: 5

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Refer & Earn",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
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
                .background(ThemeDarkBg)
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // 1. Header Title: REFER MORE TO EARN MORE (Green themed)
            Text(
                text = "REFER MORE TO EARN MORE",
                color = AccentOrange,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            // 2. Invite Text Description
            Text(
                text = "Invite your friends on App using your Referral Code to Earn $rewardCoins Rs When they join First Paid match, with minimum match fee of 10 Rs. Your friends also get $signupBonus Rs as Signup Bonus!",
                color = TextWhite,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            // 3. Subtitle dynamic description
            Text(
                text = "By Referring You Can Easily Earn from ₹$rewardCoins To ₹20000.",
                color = TextMuted,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(4.dp))

            // 4. Referral Code Box
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "YOUR REFERRAL CODE",
                    color = AccentOrange,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )

                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(ThemeCardBg)
                        .border(1.dp, ThemeBorderColor, RoundedCornerShape(8.dp))
                        .clickable {
                            val code = user?.username
                            if (!code.isNullOrBlank()) {
                                clipboardManager.setText(AnnotatedString(code))
                                Toast.makeText(context, "Referral code copied!", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(context, "Referral code not available", Toast.LENGTH_SHORT).show()
                            }
                        }
                        .padding(horizontal = 24.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = user?.username ?: "N/A",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "📋",
                        fontSize = 18.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // 5. How It Works local flowchart flowchart card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, ThemeBorderColor, RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = ThemeCardBg)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Image(
                        painter = androidx.compose.ui.res.painterResource(id = com.kingbattle.R.drawable.how_it_works),
                        contentDescription = "How It Works Flowchart",
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp)),
                        contentScale = ContentScale.FillWidth
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // 6. Green themed share button
            Button(
                onClick = {
                    val code = user?.username
                    if (!code.isNullOrBlank()) {
                        try {
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "King Battle Referral")
                                val appLink = "https://kingbattle.com"
                                val shareText = "Hey! Use my referral code *${code}* to join King Battle and get $signupBonus Rs as signup bonus! Compete in daily Free Fire matches and earn coins. Download the app here: $appLink"
                                putExtra(Intent.EXTRA_TEXT, shareText)
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Share Referral Code via"))
                        } catch (e: Exception) {
                            Toast.makeText(context, "Could not share referral code", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(context, "Please log in to share your referral code", Toast.LENGTH_SHORT).show()
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = AccentOrange),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text(
                    text = "REFER NOW",
                    color = Color.Black,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

// ==================== LEADERBOARD VIEW SCREEN ====================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaderboardScreen(
    leaderboard: List<com.kingbattle.domain.model.LeaderboardUser>,
    isLoading: Boolean,
    errorMessage: String?,
    onBack: () -> Unit,
    onRetry: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "LEADERBOARD",
                        color = TextWhite,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = TextWhite
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ThemeDarkBg)
            )
        },
        containerColor = ThemeDarkBg
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = AccentOrange
                )
            } else if (errorMessage != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(text = errorMessage, color = Color.Red, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = onRetry,
                        colors = ButtonDefaults.buttonColors(containerColor = AccentOrange)
                    ) {
                        Text("Retry")
                    }
                }
            } else if (leaderboard.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No records found.", color = TextMuted)
                }
            } else {
                val top3 = leaderboard.take(3)
                val remaining = leaderboard.drop(3)

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp)
                ) {
                    // Podium at the top
                    item {
                        LeaderboardPodium(top3 = top3)
                    }

                    // Remaining players
                    itemsIndexed(remaining) { index, player ->
                        LeaderboardItem(rankString = "${index + 4}", player = player)
                    }
                }
            }
        }
    }
}

@Composable
fun LeaderboardPodium(top3: List<com.kingbattle.domain.model.LeaderboardUser>) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        // Top 2 (Left)
        val user2 = top3.getOrNull(1)
        Box(
            modifier = Modifier
                .weight(1f)
                .height(180.dp),
            contentAlignment = Alignment.BottomCenter
        ) {
            PodiumStep(
                player = user2,
                rank = 2,
                podiumHeight = 90.dp,
                borderColor = Color(0xFF94A3B8), // Silver
                scoreColor = Color(0xFFE2E8F0)
            )
        }

        // Top 1 (Center)
        val user1 = top3.getOrNull(0)
        Box(
            modifier = Modifier
                .weight(1.1f)
                .height(220.dp),
            contentAlignment = Alignment.BottomCenter
        ) {
            PodiumStep(
                player = user1,
                rank = 1,
                podiumHeight = 120.dp,
                borderColor = AccentGold, // Gold
                scoreColor = AccentGold
            )
        }

        // Top 3 (Right)
        val user3 = top3.getOrNull(2)
        Box(
            modifier = Modifier
                .weight(1f)
                .height(160.dp),
            contentAlignment = Alignment.BottomCenter
        ) {
            PodiumStep(
                player = user3,
                rank = 3,
                podiumHeight = 70.dp,
                borderColor = Color(0xFFB45309), // Bronze
                scoreColor = Color(0xFFF59E0B)
            )
        }
    }
}

@Composable
fun PodiumStep(
    player: com.kingbattle.domain.model.LeaderboardUser?,
    rank: Int,
    podiumHeight: Dp,
    borderColor: Color,
    scoreColor: Color
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Bottom
    ) {
        if (player != null) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(ThemeCardBg)
                    .border(2.dp, borderColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = player.displayName.firstOrNull()?.toString()?.uppercase() ?: "?",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = player.displayName,
                color = TextWhite,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(text = "🪙", fontSize = 11.sp)
                Text(
                    text = "${player.coins}",
                    color = scoreColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .height(podiumHeight),
            shape = RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp),
            colors = CardDefaults.cardColors(containerColor = ThemeCardBg),
            border = BorderStroke(1.dp, borderColor)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "#$rank",
                    color = borderColor,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}

@Composable
fun LeaderboardItem(rankString: String, player: com.kingbattle.domain.model.LeaderboardUser) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .border(1.dp, ThemeBorderColor, RoundedCornerShape(8.dp)),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = ThemeCardBg)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = rankString,
                color = AccentOrange,
                fontSize = 15.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.width(36.dp)
            )
            Text(
                text = player.displayName,
                color = TextWhite,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f)
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(text = "🪙", fontSize = 14.sp)
                Text(
                    text = "${player.coins}",
                    color = Color(0xFF22C55E),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
