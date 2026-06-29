package com.kingbattle.presentation.auth

import androidx.compose.runtime.Composable

@Composable
fun OnboardingRoute(
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
) {
    OnboardingScreen(
        config = OnboardingLayoutConfig.Default,
        onNavigateToLogin = onNavigateToLogin,
        onNavigateToRegister = onNavigateToRegister,
    )
}
