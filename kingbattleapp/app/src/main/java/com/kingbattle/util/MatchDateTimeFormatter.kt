package com.kingbattle.util

import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

object MatchDateTimeFormatter {
    private val appZone = ZoneId.of("Asia/Kolkata")
    private val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)

    fun format(value: String?): String {
        if (value.isNullOrBlank()) return "TBD"

        val zoned = parse(value) ?: return value
        val local = zoned.withZoneSameInstant(appZone)
        val month = local.format(DateTimeFormatter.ofPattern("MMMM", Locale.ENGLISH))
        val time = local.format(timeFormatter)

        return "${ordinalDay(local.dayOfMonth)} $month ${local.year}, $time"
    }

    private fun parse(value: String): ZonedDateTime? {
        runCatching { return ZonedDateTime.parse(value) }
        runCatching {
            return LocalDateTime.parse(value).atZone(ZoneId.of("UTC"))
        }
        runCatching {
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atZone(appZone)
        }
        return null
    }

    private fun ordinalDay(day: Int): String {
        if (day in 11..13) return "${day}th"
        return when (day % 10) {
            1 -> "${day}st"
            2 -> "${day}nd"
            3 -> "${day}rd"
            else -> "${day}th"
        }
    }
}
