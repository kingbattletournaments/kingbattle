package com.kingbattle.presentation.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import com.kingbattle.R

@Composable
fun CoinIcon(
    modifier: Modifier = Modifier,
    size: Dp = 16.dp,
    contentDescription: String = "Coin",
) {
    Image(
        painter = painterResource(R.drawable.coin),
        contentDescription = contentDescription,
        modifier = modifier.size(size),
        contentScale = ContentScale.Fit,
    )
}

@Composable
fun CoinAmountRow(
    amount: String,
    modifier: Modifier = Modifier,
    coinSize: Dp = 16.dp,
    fontSize: TextUnit = 14.sp,
    color: Color = Color.White,
    fontWeight: FontWeight = FontWeight.Bold,
    suffix: String? = null,
    spacing: Dp = 4.dp,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(spacing),
    ) {
        CoinIcon(size = coinSize)
        Text(
            text = buildString {
                append(amount)
                if (!suffix.isNullOrEmpty()) append(suffix)
            },
            fontSize = fontSize,
            color = color,
            fontWeight = fontWeight,
        )
    }
}
