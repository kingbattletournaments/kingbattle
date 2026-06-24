package com.kingbattle.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import com.kingbattle.presentation.auth.AuthViewModel
import com.kingbattle.presentation.auth.SignInScreen
import com.kingbattle.presentation.auth.SignUpScreen
import com.kingbattle.presentation.home.HomeScreen
import com.kingbattle.presentation.welcome.WelcomeScreen

@Composable
fun RootNavigation() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val isLoggedIn = authViewModel.isLoggedIn.collectAsState()

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
                onNavigateToHome = {
                    if (isLoggedIn.value) {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(Screen.Welcome.route) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Screen.SignIn.route) {
                            popUpTo(Screen.Welcome.route) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(Screen.SignIn.route) {
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
            com.kingbattle.presentation.wallet.WalletDepositScreen(
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(Screen.WalletWithdraw.route) {
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
            com.kingbattle.presentation.matches.MatchDetailScreen(
                matchId = matchId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToWallet = {
                    navController.navigate(Screen.Wallet.route)
                }
            )
        }
    }
}

sealed class Screen(val route: String) {
    object Welcome : Screen("welcome")
    object SignIn : Screen("sign_in")
    object SignUp : Screen("sign_up")
    object Home : Screen("home")
    object Matches : Screen("matches/{modeId}?initialTab={initialTab}") {
        fun createRoute(modeId: String, initialTab: Int = 1) = "matches/$modeId?initialTab=$initialTab"
    }
    object MatchDetail : Screen("match_detail/{matchId}") {
        fun createRoute(matchId: String) = "match_detail/$matchId"
    }
    object Profile : Screen("profile")
    object Wallet : Screen("wallet")
    object WalletDeposit : Screen("wallet/deposit")
    object WalletWithdraw : Screen("wallet/withdraw")
    object Transactions : Screen("transactions")
}
