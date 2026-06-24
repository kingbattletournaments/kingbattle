/** Build local Date from YYYY-MM-DD and HH:mm (24h). */
function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm ?? 0, 0, 0);
}

/**
 * Schedule match start times from startingTime, adding gapMinutes each step,
 * while each time is <= endingTime (last slot may be before end by less than gap).
 */
export function buildMatchScheduleTimes(
  matchDate: string,
  startingTime: string,
  gapMinutes: number,
  endingTime: string,
): Date[] {
  if (!matchDate || !startingTime || !endingTime || gapMinutes <= 0) return [];

  const start = parseLocalDateTime(matchDate, startingTime);
  const end = parseLocalDateTime(matchDate, endingTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const times: Date[] = [];
  let current = start;
  while (current <= end) {
    times.push(new Date(current));
    current = new Date(current.getTime() + gapMinutes * 60 * 1000);
  }
  return times;
}

import { formatMatchDateTime } from "./format-match-datetime";

export function formatSchedulePreviewTime(d: Date): string {
  return formatMatchDateTime(d);
}
