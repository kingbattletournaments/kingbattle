package com.kingbattle.presentation.auth

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.kingbattle.R

internal data class OnboardingSlide(
    val imageRes: Int,
    val title: String,
    val description: String,
)

internal val onboardingSlides = listOf(
    OnboardingSlide(
        imageRes = R.drawable.onboarding_ss_1,
        title = "SELECT A GAME",
        description = "Join the contest of your favorite game and win real money",
    ),
    OnboardingSlide(
        imageRes = R.drawable.onboarding_ss_2,
        title = "JOIN A MATCH",
        description = "Join content as per your gameplay like SOLO, DUO or SQUAD",
    ),
    OnboardingSlide(
        imageRes = R.drawable.onboarding_ss_3,
        title = "REFER & EARN",
        description = "Invite your friends to play their favorite game and get rewarded",
    ),
)

private const val PHONE_ASPECT = 1280f / 720f

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    config: OnboardingLayoutConfig,
    onNavigateToLogin: () -> Unit,
    onNavigateToRegister: () -> Unit,
    onOpenLayoutEditor: (() -> Unit)? = null,
    previewMode: Boolean = false,
) {
    val pagerState = rememberPagerState(pageCount = { onboardingSlides.size })
    val currentPage by remember { derivedStateOf { pagerState.currentPage } }
    val currentSlide = onboardingSlides[currentPage]

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(AuthSurface),
    ) {
        val screenW = maxWidth
        val screenH = maxHeight

        val panelTop = screenH * config.panelTopFraction
        val phoneTop = screenH * config.phoneTopFraction
        val phoneHeight = screenH * config.phoneHeightFraction
        var phoneWidth = screenW * config.phoneWidthFraction
        val widthFromHeight = phoneHeight / PHONE_ASPECT
        if (widthFromHeight < phoneWidth) {
            phoneWidth = widthFromHeight
        }

        val contentTop = screenH * config.contentTopFraction
        val actionsTop = screenH * config.actionsTopFraction
        val horizontalPadding = config.horizontalPaddingDp.dp

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(panelTop)
                .background(AuthOnboardingGradient),
        )

        Box(
            modifier = Modifier
                .zIndex(0f)
                .align(Alignment.TopCenter)
                .padding(top = phoneTop)
                .width(phoneWidth)
                .height(phoneHeight),
        ) {
            HorizontalPager(
                state = pagerState,
                modifier = Modifier.fillMaxSize(),
                beyondViewportPageCount = 0,
                userScrollEnabled = !previewMode,
                key = { it },
            ) { page ->
                Image(
                    painter = painterResource(onboardingSlides[page].imageRes),
                    contentDescription = onboardingSlides[page].title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Fit,
                )
            }
        }

        Box(
            modifier = Modifier
                .zIndex(1f)
                .align(Alignment.TopStart)
                .padding(top = panelTop)
                .fillMaxWidth()
                .height(screenH - panelTop)
                .background(AuthSurface),
        )

        Column(
            modifier = Modifier
                .zIndex(2f)
                .align(Alignment.TopStart)
                .padding(
                    top = contentTop,
                    start = horizontalPadding,
                    end = horizontalPadding,
                )
                .fillMaxWidth()
                .then(
                    if (onOpenLayoutEditor != null && !previewMode) {
                        Modifier.combinedClickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = {},
                            onLongClick = onOpenLayoutEditor,
                        )
                    } else {
                        Modifier
                    },
                ),
        ) {
            Text(
                text = currentSlide.title,
                color = AuthTextDark,
                fontSize = config.titleSizeSp.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.1.sp,
                lineHeight = (config.titleSizeSp + 3.5f).sp,
            )

            Spacer(modifier = Modifier.height(config.titleToDescriptionGapDp.dp))

            Text(
                text = currentSlide.description,
                color = Color(0xFF374151),
                fontSize = config.descriptionSizeSp.sp,
                fontWeight = FontWeight.Normal,
                lineHeight = (config.descriptionSizeSp + 3.5f).sp,
                modifier = Modifier.fillMaxWidth(0.96f),
            )

            Spacer(modifier = Modifier.height(config.descriptionToDotsGapDp.dp))

            OnboardingDots(
                count = onboardingSlides.size,
                selectedIndex = currentPage,
            )
        }

        OnboardingBottomActions(
            config = config,
            modifier = Modifier
                .zIndex(2f)
                .align(Alignment.TopStart)
                .padding(
                    top = actionsTop,
                    start = horizontalPadding,
                    end = horizontalPadding,
                )
                .fillMaxWidth(),
            onNavigateToRegister = if (previewMode) ({}) else onNavigateToRegister,
            onNavigateToLogin = if (previewMode) ({}) else onNavigateToLogin,
            enabled = !previewMode,
        )

        if (onOpenLayoutEditor != null && !previewMode) {
            TextButton(
                onClick = onOpenLayoutEditor,
                modifier = Modifier
                    .zIndex(3f)
                    .align(Alignment.TopEnd)
                    .padding(top = 4.dp, end = 4.dp),
            ) {
                Text(
                    text = "Tune layout",
                    color = AuthBlue,
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
internal fun OnboardingDots(
    count: Int,
    selectedIndex: Int,
) {
    Row(
        horizontalArrangement = Arrangement.Start,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(count) { index ->
            val selected = selectedIndex == index
            Box(
                modifier = Modifier
                    .padding(end = 4.dp)
                    .height(2.5.dp)
                    .width(if (selected) 17.dp else 9.dp)
                    .clip(RoundedCornerShape(1.5.dp))
                    .background(if (selected) AuthBlue else Color(0xFFCBD5E1)),
            )
        }
    }
}

@Composable
internal fun OnboardingBottomActions(
    config: OnboardingLayoutConfig,
    onNavigateToRegister: () -> Unit,
    onNavigateToLogin: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Column(
            modifier = Modifier
                .then(
                    if (enabled) {
                        Modifier.clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onNavigateToRegister,
                        )
                    } else {
                        Modifier
                    },
                ),
            horizontalAlignment = Alignment.Start,
        ) {
            Text(
                text = "Don't have an account?",
                color = Color(0xFF6B7280),
                fontSize = config.actionLabelSizeSp.sp,
                lineHeight = (config.actionLabelSizeSp + 2f).sp,
            )
            Text(
                text = "REGISTER",
                color = AuthTextDark,
                fontSize = config.actionTitleSizeSp.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp,
                lineHeight = (config.actionTitleSizeSp + 2.5f).sp,
            )
        }

        Column(
            modifier = Modifier
                .then(
                    if (enabled) {
                        Modifier.clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onNavigateToLogin,
                        )
                    } else {
                        Modifier
                    },
                ),
            horizontalAlignment = Alignment.End,
        ) {
            Text(
                text = "Already a user?",
                color = Color(0xFF6B7280),
                fontSize = config.actionLabelSizeSp.sp,
                lineHeight = (config.actionLabelSizeSp + 2f).sp,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "LOGIN",
                color = AuthBlue,
                fontSize = config.actionTitleSizeSp.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.2.sp,
                lineHeight = (config.actionTitleSizeSp + 2.5f).sp,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
