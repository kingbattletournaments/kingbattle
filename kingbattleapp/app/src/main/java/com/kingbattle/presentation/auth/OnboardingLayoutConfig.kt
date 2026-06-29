package com.kingbattle.presentation.auth

import android.content.Context
import androidx.compose.runtime.mutableStateOf
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.max
import kotlin.math.min

/**
 * Tunable onboarding layout values. Fractions are relative to screen width/height (0f–1f).
 */
data class OnboardingLayoutConfig(
    val phoneTopFraction: Float = 0.093f,
    val phoneHeightFraction: Float = 0.738f,
    val phoneWidthFraction: Float = 0.94f,
    val panelTopFraction: Float = 0.733f,
    val contentTopFraction: Float = 0.802f,
    val actionsTopFraction: Float = 0.911f,
    val horizontalPaddingDp: Int = 22,
    val titleToDescriptionGapDp: Int = 4,
    val descriptionToDotsGapDp: Int = 9,
    val titleSizeSp: Float = 15.5f,
    val descriptionSizeSp: Float = 11.113f,
    val actionLabelSizeSp: Float = 10f,
    val actionTitleSizeSp: Float = 15.5f,
) {
    /** Estimated text block height (title + description + dots + internal gaps). */
    fun estimateTextBlockHeightDp(): Int {
        val titleH = (titleSizeSp * 1.35f).toInt()
        val descH = (descriptionSizeSp * 2.6f).toInt()
        return titleH + titleToDescriptionGapDp + descH + descriptionToDotsGapDp + 4
    }

    fun estimateActionsBlockHeightDp(): Int {
        val labelH = (actionLabelSizeSp * 1.3f).toInt()
        val titleH = (actionTitleSizeSp * 1.25f).toInt()
        return labelH + titleH + 2
    }

    fun metrics(screenHeightDp: Int): OnboardingLayoutMetrics {
        val safeHeight = max(screenHeightDp, 1)
        val textBlockDp = estimateTextBlockHeightDp()
        val actionsBlockDp = estimateActionsBlockHeightDp()
        val whiteHeightFraction = 1f - panelTopFraction
        val textPaddingTopFraction = contentTopFraction - panelTopFraction
        val textPaddingTopDp = (textPaddingTopFraction * safeHeight).toInt()
        val textBlockBottomFraction = contentTopFraction + (textBlockDp / safeHeight.toFloat())
        val gapFraction = actionsTopFraction - textBlockBottomFraction
        val gapDp = max(0, (gapFraction * safeHeight).toInt())
        val actionsBottomFraction = actionsTopFraction + (actionsBlockDp / safeHeight.toFloat())
        val whiteBottomPaddingDp = max(0, ((1f - actionsBottomFraction) * safeHeight).toInt())

        return OnboardingLayoutMetrics(
            whiteCardHeightFraction = whiteHeightFraction,
            whiteCardHeightDp = (whiteHeightFraction * safeHeight).toInt(),
            textPaddingTopInsideCardFraction = textPaddingTopFraction,
            textPaddingTopInsideCardDp = textPaddingTopDp,
            textBlockHeightDp = textBlockDp,
            gapTextBlockToButtonsFraction = gapFraction,
            gapTextBlockToButtonsDp = gapDp,
            actionsBlockHeightDp = actionsBlockDp,
            whiteCardBottomPaddingDp = whiteBottomPaddingDp,
        )
    }

    /** Keeps text + buttons inside the white card with minimum spacing. */
    fun clamped(): OnboardingLayoutConfig {
        val refH = 844f
        val textBlockF = estimateTextBlockHeightDp() / refH
        val actionsBlockF = estimateActionsBlockHeightDp() / refH
        val minGapF = 0.024f
        val innerPadF = 0.006f

        var c = this

        val minContentTop = c.panelTopFraction + innerPadF
        c = c.copy(contentTopFraction = c.contentTopFraction.coerceIn(minContentTop, 0.82f))

        val minActionsTop = c.contentTopFraction + textBlockF + minGapF
        val maxActionsTop = 0.96f - actionsBlockF
        c = c.copy(actionsTopFraction = c.actionsTopFraction.coerceIn(minActionsTop, maxActionsTop))

        val maxPanelTop = min(c.contentTopFraction, c.actionsTopFraction) - innerPadF
        val minPanelTop = c.actionsTopFraction + actionsBlockF + 0.012f - 1f
        c = c.copy(
            panelTopFraction = c.panelTopFraction.coerceIn(
                max(0.45f, minPanelTop),
                max(0.45f, maxPanelTop),
            ),
        )

        val minContentTop2 = c.panelTopFraction + innerPadF
        c = c.copy(contentTopFraction = c.contentTopFraction.coerceIn(minContentTop2, 0.82f))

        val minActionsTop2 = c.contentTopFraction + textBlockF + minGapF
        c = c.copy(actionsTopFraction = c.actionsTopFraction.coerceIn(minActionsTop2, maxActionsTop))

        val maxPanelTop2 = min(c.contentTopFraction, c.actionsTopFraction) - innerPadF
        c = c.copy(panelTopFraction = c.panelTopFraction.coerceAtMost(maxPanelTop2))

        return c
    }

    fun maxPanelTopFraction(): Float {
        val innerPadF = 0.006f
        return min(contentTopFraction, actionsTopFraction) - innerPadF
    }

    fun toLayoutCode(screenHeightDp: Int = 844): String {
        val m = metrics(screenHeightDp)
        return buildString {
            appendLine("KB_ONBOARDING_LAYOUT")
            appendLine("phoneTopFraction=${format(phoneTopFraction)}")
            appendLine("phoneHeightFraction=${format(phoneHeightFraction)}")
            appendLine("phoneWidthFraction=${format(phoneWidthFraction)}")
            appendLine("panelTopFraction=${format(panelTopFraction)}")
            appendLine("contentTopFraction=${format(contentTopFraction)}")
            appendLine("actionsTopFraction=${format(actionsTopFraction)}")
            appendLine("horizontalPaddingDp=$horizontalPaddingDp")
            appendLine("titleToDescriptionGapDp=$titleToDescriptionGapDp")
            appendLine("descriptionToDotsGapDp=$descriptionToDotsGapDp")
            appendLine("titleSizeSp=${format(titleSizeSp)}")
            appendLine("descriptionSizeSp=${format(descriptionSizeSp)}")
            appendLine("actionLabelSizeSp=${format(actionLabelSizeSp)}")
            appendLine("actionTitleSizeSp=${format(actionTitleSizeSp)}")
            appendLine("# --- computed (reference screen ${screenHeightDp}dp) ---")
            appendLine("whiteCardHeightFraction=${format(m.whiteCardHeightFraction)}")
            appendLine("whiteCardHeightDp=${m.whiteCardHeightDp}")
            appendLine("textPaddingTopInsideCardFraction=${format(m.textPaddingTopInsideCardFraction)}")
            appendLine("textPaddingTopInsideCardDp=${m.textPaddingTopInsideCardDp}")
            appendLine("textBlockHeightDp=${m.textBlockHeightDp}")
            appendLine("gapTextBlockToButtonsFraction=${format(m.gapTextBlockToButtonsFraction)}")
            appendLine("gapTextBlockToButtonsDp=${m.gapTextBlockToButtonsDp}")
            appendLine("actionsBlockHeightDp=${m.actionsBlockHeightDp}")
            appendLine("whiteCardBottomPaddingDp=${m.whiteCardBottomPaddingDp}")
            appendLine("END")
        }
    }

    companion object {
        val Default = OnboardingLayoutConfig()

        fun fromLayoutCode(code: String): OnboardingLayoutConfig? {
            if (!code.contains("KB_ONBOARDING_LAYOUT")) return null
            val map = code.lineSequence()
                .map { it.trim() }
                .filter { it.contains("=") && !it.startsWith("#") && !it.startsWith("KB_") && it != "END" }
                .mapNotNull { line ->
                    val parts = line.split("=", limit = 2)
                    if (parts.size == 2) parts[0] to parts[1] else null
                }
                .toMap()
            if (map.isEmpty()) return null
            return OnboardingLayoutConfig(
                phoneTopFraction = map.float("phoneTopFraction") ?: Default.phoneTopFraction,
                phoneHeightFraction = map.float("phoneHeightFraction") ?: Default.phoneHeightFraction,
                phoneWidthFraction = map.float("phoneWidthFraction") ?: Default.phoneWidthFraction,
                panelTopFraction = map.float("panelTopFraction") ?: Default.panelTopFraction,
                contentTopFraction = map.float("contentTopFraction") ?: Default.contentTopFraction,
                actionsTopFraction = map.float("actionsTopFraction") ?: Default.actionsTopFraction,
                horizontalPaddingDp = map.int("horizontalPaddingDp") ?: Default.horizontalPaddingDp,
                titleToDescriptionGapDp = map.int("titleToDescriptionGapDp") ?: Default.titleToDescriptionGapDp,
                descriptionToDotsGapDp = map.int("descriptionToDotsGapDp") ?: Default.descriptionToDotsGapDp,
                titleSizeSp = map.float("titleSizeSp") ?: Default.titleSizeSp,
                descriptionSizeSp = map.float("descriptionSizeSp") ?: Default.descriptionSizeSp,
                actionLabelSizeSp = map.float("actionLabelSizeSp") ?: Default.actionLabelSizeSp,
                actionTitleSizeSp = map.float("actionTitleSizeSp") ?: Default.actionTitleSizeSp,
            ).clamped()
        }

        private fun Map<String, String>.float(key: String): Float? = this[key]?.toFloatOrNull()
        private fun Map<String, String>.int(key: String): Int? = this[key]?.toIntOrNull()
        private fun format(value: Float): String = "%.3f".format(value)
    }
}

data class OnboardingLayoutMetrics(
    val whiteCardHeightFraction: Float,
    val whiteCardHeightDp: Int,
    val textPaddingTopInsideCardFraction: Float,
    val textPaddingTopInsideCardDp: Int,
    val textBlockHeightDp: Int,
    val gapTextBlockToButtonsFraction: Float,
    val gapTextBlockToButtonsDp: Int,
    val actionsBlockHeightDp: Int,
    val whiteCardBottomPaddingDp: Int,
)

@Singleton
class OnboardingLayoutStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val configState = mutableStateOf(load())

    fun load(): OnboardingLayoutConfig = OnboardingLayoutConfig(
        phoneTopFraction = prefs.getFloat(KEY_PHONE_TOP, OnboardingLayoutConfig.Default.phoneTopFraction),
        phoneHeightFraction = prefs.getFloat(KEY_PHONE_HEIGHT, OnboardingLayoutConfig.Default.phoneHeightFraction),
        phoneWidthFraction = prefs.getFloat(KEY_PHONE_WIDTH, OnboardingLayoutConfig.Default.phoneWidthFraction),
        panelTopFraction = prefs.getFloat(KEY_PANEL_TOP, OnboardingLayoutConfig.Default.panelTopFraction),
        contentTopFraction = prefs.getFloat(KEY_CONTENT_TOP, OnboardingLayoutConfig.Default.contentTopFraction),
        actionsTopFraction = prefs.getFloat(KEY_ACTIONS_TOP, OnboardingLayoutConfig.Default.actionsTopFraction),
        horizontalPaddingDp = prefs.getInt(KEY_H_PAD, OnboardingLayoutConfig.Default.horizontalPaddingDp),
        titleToDescriptionGapDp = prefs.getInt(KEY_TITLE_GAP, OnboardingLayoutConfig.Default.titleToDescriptionGapDp),
        descriptionToDotsGapDp = prefs.getInt(KEY_DESC_GAP, OnboardingLayoutConfig.Default.descriptionToDotsGapDp),
        titleSizeSp = prefs.getFloat(KEY_TITLE_SP, OnboardingLayoutConfig.Default.titleSizeSp),
        descriptionSizeSp = prefs.getFloat(KEY_DESC_SP, OnboardingLayoutConfig.Default.descriptionSizeSp),
        actionLabelSizeSp = prefs.getFloat(KEY_ACTION_LABEL_SP, OnboardingLayoutConfig.Default.actionLabelSizeSp),
        actionTitleSizeSp = prefs.getFloat(KEY_ACTION_TITLE_SP, OnboardingLayoutConfig.Default.actionTitleSizeSp),
    ).clamped()

    fun save(config: OnboardingLayoutConfig) {
        val c = config.clamped()
        prefs.edit()
            .putFloat(KEY_PHONE_TOP, c.phoneTopFraction)
            .putFloat(KEY_PHONE_HEIGHT, c.phoneHeightFraction)
            .putFloat(KEY_PHONE_WIDTH, c.phoneWidthFraction)
            .putFloat(KEY_PANEL_TOP, c.panelTopFraction)
            .putFloat(KEY_CONTENT_TOP, c.contentTopFraction)
            .putFloat(KEY_ACTIONS_TOP, c.actionsTopFraction)
            .putInt(KEY_H_PAD, c.horizontalPaddingDp)
            .putInt(KEY_TITLE_GAP, c.titleToDescriptionGapDp)
            .putInt(KEY_DESC_GAP, c.descriptionToDotsGapDp)
            .putFloat(KEY_TITLE_SP, c.titleSizeSp)
            .putFloat(KEY_DESC_SP, c.descriptionSizeSp)
            .putFloat(KEY_ACTION_LABEL_SP, c.actionLabelSizeSp)
            .putFloat(KEY_ACTION_TITLE_SP, c.actionTitleSizeSp)
            .apply()
        configState.value = c
    }

    fun reset() {
        save(OnboardingLayoutConfig.Default)
    }

    companion object {
        private const val PREFS_NAME = "onboarding_layout_config"
        private const val KEY_PHONE_TOP = "phone_top"
        private const val KEY_PHONE_HEIGHT = "phone_height"
        private const val KEY_PHONE_WIDTH = "phone_width"
        private const val KEY_PANEL_TOP = "panel_top"
        private const val KEY_CONTENT_TOP = "content_top"
        private const val KEY_ACTIONS_TOP = "actions_top"
        private const val KEY_H_PAD = "h_pad"
        private const val KEY_TITLE_GAP = "title_gap"
        private const val KEY_DESC_GAP = "desc_gap"
        private const val KEY_TITLE_SP = "title_sp"
        private const val KEY_DESC_SP = "desc_sp"
        private const val KEY_ACTION_LABEL_SP = "action_label_sp"
        private const val KEY_ACTION_TITLE_SP = "action_title_sp"
    }
}
