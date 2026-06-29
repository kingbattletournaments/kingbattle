package com.kingbattle.presentation.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

data class ImageDecodeSize(
    val widthPx: Int,
    val heightPx: Int,
) {
    init {
        require(widthPx > 0 && heightPx > 0)
    }
}

@Composable
fun rememberImageDecodeSize(
    width: Dp,
    height: Dp,
): ImageDecodeSize {
    val density = LocalDensity.current
    return remember(width, height, density) {
        ImageDecodeSize(
            widthPx = with(density) { width.roundToPx() },
            heightPx = with(density) { height.roundToPx() },
        )
    }
}

/** Full-width banner decode size (16:9) with horizontal screen padding subtracted. */
@Composable
fun rememberBannerDecodeSize(
    horizontalPadding: Dp = 32.dp,
): ImageDecodeSize {
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    return remember(configuration.screenWidthDp, horizontalPadding, density) {
        val widthPx = with(density) {
            (configuration.screenWidthDp.dp - horizontalPadding).roundToPx().coerceAtLeast(1)
        }
        ImageDecodeSize(
            widthPx = widthPx,
            heightPx = (widthPx * 9f / 16f).roundToInt().coerceAtLeast(1),
        )
    }
}
