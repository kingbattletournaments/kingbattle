package com.kingbattle.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.kingbattle.di.FcmEntryPoint
import com.kingbattle.presentation.auth.AuthViewModel
import com.kingbattle.presentation.auth.SignInScreen
import com.kingbattle.presentation.auth.SignUpScreen
import com.kingbattle.presentation.home.HomeScreen
import com.kingbattle.presentation.welcome.WelcomeScreen
import com.kingbattle.util.NotificationDeepLink
import dagger.hilt.android.EntryPointAccessors

@Composable
fun RootNavigation() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val isLoggedIn = authViewModel.isLoggedIn.collectAsState()
    val pendingMatchId by NotificationDeepLink.pendingMatchId.collectAsState()
    val appContext = LocalContext.current.applicationContext
    val tokenManager = remember(appContext) {
        EntryPointAccessors.fromApplication(appContext, FcmEntryPoint::class.java).tokenManager()
    }

    LaunchedEffect(isLoggedIn.value, pendingMatchId) {
        val matchId = pendingMatchId ?: return@LaunchedEffect
        if (!isLoggedIn.value) return@LaunchedEffect

        NotificationDeepLink.consumePendingMatchId()
        tokenManager.saveJoinedMatch(matchId)

        val detailRoute = Screen.MatchDetail.createRoute(matchId)
        val currentRoute = navController.currentBackStackEntry?.destination?.route
        if (currentRoute == detailRoute) return@LaunchedEffect

        navController.navigate(Screen.Home.route) {
            popUpTo(Screen.Welcome.route) { inclusive = true }
            launchSingleTop = true
        }
        navController.navigate(detailRoute) {
            launchSingleTop = true
        }
    }

    // System back: pop nested routes until Home; Home handles its own overlays/tabs.
    BackHandler(enabled = navController.previousBackStackEntry != null) {
        navController.popBackStack()
    }

    // Commented out authentication check and redirects for development/testing
    /*
    LaunchedEffect(isLoggedIn.value) {
        if (isLoggedIn.value) {
            navController.navigate(Screen.Home.route) {
                popUpTo(Screen.SignIn.route) { inclusive = true }
            }
        } else {
            navController.navigate(Screen.SignIn.route) {
                popUpTo(navController.graph.startDestinationId) { inclusive = true }
            }
        }
    }
    */

    NavHost(
        navController = navController,
        startDestination = Screen.Welcome.route
    ) {
        composable(Screen.Welcome.route) {
            WelcomeScreen(
                onNavigateNext = {
                    if (isLoggedIn.value) {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Welcome.route) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Screen.Onboarding.route) {
                            popUpTo(Screen.Welcome.route) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(Screen.Onboarding.route) {
            HandleNavBack(navController)
            com.kingbattle.presentation.auth.OnboardingRoute(
                onNavigateToLogin = {
                    navController.navigate(Screen.SignIn.route)
                },
                onNavigateToRegister = {
                    navController.navigate(Screen.SignUp.route)
                },
            )
        }

        composable(Screen.SignIn.route) {
            HandleNavBack(navController)
            SignInScreen(
                onSignInSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.SignIn.route) { inclusive = true }
                    }
                },
                onNavigateToSignUp = {
                    navController.navigate(Screen.SignUp.route)
                }
            )
        }

        composable(Screen.SignUp.route) {
            SignUpScreen(
                onSignUpSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.SignUp.route) { inclusive = true }
                    }
                },
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
            HandleNavBack(navController)
        }

        // App Stack
        composable(Screen.Home.route) {
            HomeScreen(
                onLogout = {
                    navController.navigate(Screen.SignIn.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                },
                onNavigateToMatches = { modeId, initialTab ->
                    navController.navigate(Screen.Matches.createRoute(modeId, initialTab))
                },
                onNavigateToWallet = {
                    navController.navigate(Screen.Wallet.route)
                }
            )
        }

        composable(Screen.Wallet.route) {
            HandleNavBack(navController)
            com.kingbattle.presentation.wallet.WalletScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToDeposit = {
                    navController.navigate(Screen.WalletDeposit.route)
                },
                onNavigateToWithdraw = {
                    navController.navigate(Screen.WalletWithdraw.route)
                }
            )
        }

        composable(Screen.WalletDeposit.route) {
            HandleNavBack(navController)
            com.kingbattle.presentation.wallet.WalletDepositScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.WalletWithdraw.route) {
            HandleNavBack(navController)
            com.kingbattle.presentation.wallet.WalletWithdrawScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = "matches/{modeId}?initialTab={initialTab}",
            arguments = listOf(
                navArgument("modeId") { type = NavType.StringType },
                navArgument("initialTab") {
                    type = NavType.IntType
                    defaultValue = 1
                }
            )
        ) { backStackEntry ->
            val modeId = backStackEntry.arguments?.getString("modeId") ?: ""
            val initialTab = backStackEntry.arguments?.getInt("initialTab") ?: 1
            HandleNavBack(navController)
            com.kingbattle.presentation.matches.MatchesScreen(
                modeId = modeId,
                initialTab = initialTab,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToWallet = {
                    navController.navigate(Screen.Wallet.route)
                },
                onNavigateToMatchDetail = { matchId ->
                    navController.navigate(Screen.MatchDetail.createRoute(matchId))
                },
                onNavigateToSlotSelection = { id, title ->
                    val returnModeId = com.kingbattle.presentation.matches.SelectedMatchHolder.sourceModeId ?: modeId
                    val returnTab = com.kingbattle.presentation.matches.SelectedMatchHolder.sourceInitialTab
                    navController.navigate(
                        Screen.MatchSlots.createRoute(id, title, returnModeId, returnTab),
                    )
                }
            )
        }

        composable(
            route = Screen.MatchDetail.route,
            arguments = listOf(
                navArgument("matchId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val matchId = backStackEntry.arguments?.getString("matchId") ?: ""
            HandleNavBack(navController)
            com.kingbattle.presentation.matches.MatchDetailScreen(
                matchId = matchId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToWallet = {
                    navController.navigate(Screen.Wallet.route)
                },
                onNavigateToSlotSelection = { id, title ->
                    val returnModeId = com.kingbattle.presentation.matches.SelectedMatchHolder.sourceModeId.orEmpty()
                    val returnTab = com.kingbattle.presentation.matches.SelectedMatchHolder.sourceInitialTab
                    navController.navigate(
                        Screen.MatchSlots.createRoute(id, title, returnModeId, returnTab),
                    )
                }
            )
        }

        composable(
            route = Screen.MatchSlots.route,
            arguments = listOf(
                navArgument("matchId") { type = NavType.StringType },
                navArgument("matchTitle") { type = NavType.StringType },
                navArgument("modeId") {
                    type = NavType.StringType
                    defaultValue = ""
                },
                navArgument("initialTab") {
                    type = NavType.IntType
                    defaultValue = 1
                },
            )
        ) { backStackEntry ->
            val matchId = backStackEntry.arguments?.getString("matchId") ?: ""
            val matchTitle = java.net.URLDecoder.decode(
                backStackEntry.arguments?.getString("matchTitle") ?: "Match",
                "UTF-8"
            )
            val returnModeId = backStackEntry.arguments?.getString("modeId").orEmpty()
                .ifEmpty { com.kingbattle.presentation.matches.SelectedMatchHolder.sourceModeId.orEmpty() }
            val returnTab = backStackEntry.arguments?.getInt("initialTab")
                ?: com.kingbattle.presentation.matches.SelectedMatchHolder.sourceInitialTab
            if (returnModeId.isNotEmpty()) {
                com.kingbattle.presentation.matches.SelectedMatchHolder.sourceModeId = returnModeId
                com.kingbattle.presentation.matches.SelectedMatchHolder.sourceInitialTab = returnTab
            }
            val slotViewModel: com.kingbattle.presentation.matches.SlotSelectionViewModel =
                hiltViewModel(backStackEntry)
            HandleNavBack(navController)
            com.kingbattle.presentation.matches.SlotSelectionScreen(
                matchId = matchId,
                matchTitle = matchTitle,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToDetails = {
                    navController.navigate(Screen.JoinSlotDetails.createRoute(matchId))
                },
                viewModel = slotViewModel,
            )
        }

        composable(
            route = Screen.JoinSlotDetails.route,
            arguments = listOf(navArgument("matchId") { type = NavType.StringType })
        ) { backStackEntry ->
            val matchId = backStackEntry.arguments?.getString("matchId") ?: ""
            val parentEntry = navController.previousBackStackEntry
            if (parentEntry != null) {
                val slotViewModel: com.kingbattle.presentation.matches.SlotSelectionViewModel =
                    hiltViewModel(parentEntry)
                HandleNavBack(navController)
                com.kingbattle.presentation.matches.JoinSlotDetailsScreen(
                    matchId = matchId,
                    onNavigateBack = { navController.popBackStack() },
                    onJoinSuccess = {
                        val modeId = com.kingbattle.presentation.matches.SelectedMatchHolder.sourceModeId.orEmpty()
                        val initialTab = com.kingbattle.presentation.matches.SelectedMatchHolder.sourceInitialTab
                        if (modeId.isNotEmpty()) {
                            navController.popBackStack(
                                Screen.Matches.createRoute(modeId, initialTab),
                                inclusive = false,
                            )
                        } else {
                            navController.popBackStack(Screen.Home.route, inclusive = false)
                        }
                    },
                    viewModel = slotViewModel,
                )
            }
        }
    }
}

sealed class Screen(val route: String) {
    object Welcome : Screen("welcome")
    object Onboarding : Screen("onboarding")
    object SignIn : Screen("sign_in")
    object SignUp : Screen("sign_up")
    object Home : Screen("home")
    object Matches : Screen("matches/{modeId}?initialTab={initialTab}") {
        fun createRoute(modeId: String, initialTab: Int = 1) = "matches/$modeId?initialTab=$initialTab"
    }
    object MatchDetail : Screen("match_detail/{matchId}") {
        fun createRoute(matchId: String) = "match_detail/$matchId"
    }
    object MatchSlots : Screen("match_slots/{matchId}/{matchTitle}?modeId={modeId}&initialTab={initialTab}") {
        fun createRoute(matchId: String, matchTitle: String, modeId: String = "", initialTab: Int = 1) =
            "match_slots/$matchId/${java.net.URLEncoder.encode(matchTitle, "UTF-8")}?modeId=$modeId&initialTab=$initialTab"
    }
    object JoinSlotDetails : Screen("join_slot_details/{matchId}") {
        fun createRoute(matchId: String) = "join_slot_details/$matchId"
    }
    object Profile : Screen("profile")
    object Wallet : Screen("wallet")
    object WalletDeposit : Screen("wallet/deposit")
    object WalletWithdraw : Screen("wallet/withdraw")
    object Transactions : Screen("transactions")
}
