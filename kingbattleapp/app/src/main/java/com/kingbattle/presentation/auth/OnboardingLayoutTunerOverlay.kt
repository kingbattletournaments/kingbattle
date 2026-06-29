package com.kingbattle.presentation.auth

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingLayoutTunerOverlay(
    visible: Boolean,
    config: OnboardingLayoutConfig,
    onConfigChange: (OnboardingLayoutConfig) -> Unit,
    onDismiss: () -> Unit,
    onApply: () -> Unit,
) {
    if (!visible) return

    val context = LocalContext.current
    val screenHeightDp = LocalConfiguration.current.screenHeightDp
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showCodeDialog by remember { mutableStateOf(false) }
    var generatedCode by remember { mutableStateOf("") }

    val metrics = config.metrics(screenHeightDp)
    val maxPanelTop = config.maxPanelTopFraction()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AuthSurface,
        dragHandle = null,
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = (screenHeightDp * 0.46f).dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "Layout tuner",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = AuthTextDark,
                )
                TextButton(onClick = onDismiss) {
                    Text("Close", color = AuthTextMuted, fontSize = 13.sp)
                }
            }

            Text(
                text = "UI stays full screen behind this panel. White card must fit text + buttons.",
                fontSize = 11.sp,
                color = AuthTextMuted,
                modifier = Modifier.padding(bottom = 6.dp),
            )

            MetricsSummary(metrics)

            Text(
                text = "Phone mockup",
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = AuthTextDark,
                modifier = Modifier.padding(top = 4.dp),
            )
            FractionSlider("Top", config.phoneTopFraction, 0f, 0.12f) {
                onConfigChange(config.copy(phoneTopFraction = it).clamped())
            }
            FractionSlider("Height", config.phoneHeightFraction, 0.55f, 0.95f) {
                onConfigChange(config.copy(phoneHeightFraction = it).clamped())
            }
            FractionSlider("Width", config.phoneWidthFraction, 0.65f, 1f) {
                onConfigChange(config.copy(phoneWidthFraction = it).clamped())
            }

            Text(
                text = "White card",
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = AuthTextDark,
                modifier = Modifier.padding(top = 6.dp),
            )
            FractionSlider(
                label = "Card top (max ${"%.3f".format(maxPanelTop)})",
                value = config.panelTopFraction,
                min = 0.45f,
                maxValue = maxOf(0.46f, maxPanelTop),
            ) {
                onConfigChange(config.copy(panelTopFraction = it).clamped())
            }

            Text(
                text = "Text block",
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = AuthTextDark,
                modifier = Modifier.padding(top = 6.dp),
            )
            FractionSlider("Text top", config.contentTopFraction, config.panelTopFraction + 0.006f, 0.82f) {
                onConfigChange(config.copy(contentTopFraction = it).clamped())
            }
            IntSlider("Title → description (dp)", config.titleToDescriptionGapDp, 0, 24) {
                onConfigChange(config.copy(titleToDescriptionGapDp = it).clamped())
            }
            IntSlider("Description → dots (dp)", config.descriptionToDotsGapDp, 0, 32) {
                onConfigChange(config.copy(descriptionToDotsGapDp = it).clamped())
            }

            Text(
                text = "Register / Login",
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = AuthTextDark,
                modifier = Modifier.padding(top = 6.dp),
            )
            FractionSlider(
                label = "Buttons top",
                value = config.actionsTopFraction,
                min = config.contentTopFraction + 0.03f,
                maxValue = 0.94f,
            ) {
                onConfigChange(config.copy(actionsTopFraction = it).clamped())
            }
            IntSlider("Side padding (dp)", config.horizontalPaddingDp, 8, 40) {
                onConfigChange(config.copy(horizontalPaddingDp = it).clamped())
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = {
                        generatedCode = config.clamped().toLayoutCode(screenHeightDp)
                        showCodeDialog = true
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = AuthBlue),
                ) {
                    Text("Generate code", fontSize = 13.sp)
                }
                Button(
                    onClick = onApply,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = AuthBlueDark),
                ) {
                    Text("Apply", fontSize = 13.sp)
                }
            }

            OutlinedButton(
                onClick = { onConfigChange(OnboardingLayoutConfig.Default.clamped()) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Reset defaults", fontSize = 13.sp)
            }
        }
    }

    if (showCodeDialog) {
        AlertDialog(
            onDismissRequest = { showCodeDialog = false },
            title = { Text("Layout code") },
            text = {
                Column {
                    Text(
                        text = "Send this block to finalize the permanent UI:",
                        fontSize = 12.sp,
                        color = AuthTextMuted,
                    )
                    Text(
                        text = generatedCode,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        lineHeight = 13.sp,
                        modifier = Modifier
                            .padding(top = 10.dp)
                            .background(Color(0xFFF3F4F6))
                            .padding(8.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("KB onboarding layout", generatedCode))
                        Toast.makeText(context, "Copied to clipboard", Toast.LENGTH_SHORT).show()
                        showCodeDialog = false
                    },
                ) {
                    Text("Copy", color = AuthBlue)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCodeDialog = false }) {
                    Text("Close")
                }
            },
        )
    }
}

@Composable
private fun MetricsSummary(metrics: OnboardingLayoutMetrics) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFEFF6FF), RoundedCornerShape(8.dp))
            .padding(10.dp),
    ) {
        Text("Live card metrics", fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = AuthBlueDark)
        Text("White card height: ${metrics.whiteCardHeightDp}dp (${"%.1f".format(metrics.whiteCardHeightFraction * 100)}%)", fontSize = 10.sp)
        Text("Text padding inside card: ${metrics.textPaddingTopInsideCardDp}dp", fontSize = 10.sp)
        Text("Gap text block → buttons: ${metrics.gapTextBlockToButtonsDp}dp", fontSize = 10.sp)
        Text("Bottom padding in card: ${metrics.whiteCardBottomPaddingDp}dp", fontSize = 10.sp)
    }
}

@Composable
private fun FractionSlider(
    label: String,
    value: Float,
    min: Float,
    maxValue: Float,
    onChange: (Float) -> Unit,
) {
    val safeMax = maxOf(maxValue, min + 0.001f)
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = "$label: ${"%.3f".format(value)}", fontSize = 11.sp, color = AuthTextMuted)
        Slider(
            value = value.coerceIn(min, safeMax),
            onValueChange = onChange,
            valueRange = min..safeMax,
        )
    }
}

@Composable
private fun IntSlider(
    label: String,
    value: Int,
    min: Int,
    max: Int,
    onChange: (Int) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = "$label: $value", fontSize = 11.sp, color = AuthTextMuted)
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toInt()) },
            valueRange = min.toFloat()..max.toFloat(),
            steps = (max - min - 1).coerceAtLeast(0),
        )
    }
}
