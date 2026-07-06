package com.kingbattle.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController

/** Wire the system back button to [NavHostController.popBackStack]. */
@Composable
fun HandleNavBack(
    navController: NavHostController,
    enabled: Boolean = navController.previousBackStackEntry != null,
) {
    BackHandler(enabled = enabled) {
        navController.popBackStack()
    }
}

/** Wire the system back button to a custom action (e.g. close overlay). */
@Composable
fun HandleCustomBack(
    enabled: Boolean = true,
    onBack: () -> Unit,
) {
    BackHandler(enabled = enabled, onBack = onBack)
}
