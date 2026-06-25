package com.kingbattle.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.kingbattle.presentation.home.TextMuted
import com.kingbattle.presentation.home.ThemeCardBg

@Composable
fun CachedNetworkImage(
    url: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
) {
    if (url.isBlank()) {
        ImagePlaceholder(modifier = modifier)
        return
    }

    SubcomposeAsyncImage(
        model = url,
        contentDescription = contentDescription,
        modifier = modifier,
        contentScale = contentScale,
        loading = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .shimmerEffect(),
            )
        },
        error = {
            ImagePlaceholder(modifier = Modifier.fillMaxSize())
        },
    )
}

@Composable
private fun ImagePlaceholder(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.background(ThemeCardBg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "KING BATTLE",
            color = TextMuted.copy(alpha = 0.3f),
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
        )
    }
}
