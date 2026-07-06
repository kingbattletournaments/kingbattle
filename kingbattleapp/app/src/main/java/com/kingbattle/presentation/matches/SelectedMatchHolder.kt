package com.kingbattle.presentation.matches

object SelectedMatchHolder {
    var selectedMatch: com.kingbattle.domain.model.Match? = null
    /** Mode list the user came from (for post-join navigation). */
    var sourceModeId: String? = null
    /** Tab index within that mode's matches list (0=ongoing, 1=upcoming, 2=results). */
    var sourceInitialTab: Int = 1
}
