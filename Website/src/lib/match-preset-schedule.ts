import { formatMatchDateTime } from "./format-match-datetime";
import { parseAppWallClock } from "./app-timezone";

/**
 * Schedule match start times from startingTime, adding gapMinutes each step,
 * while each time is <= endingTime (last slot may be before end by less than gap).
 * Times are interpreted as IST wall-clock (same on browser and Vercel).
 */
export function buildMatchScheduleTimes(
  matchDate: string,
  startingTime: string,
  gapMinutes: number,
  endingTime: string,
): Date[] {
  if (!matchDate || !startingTime || !endingTime || gapMinutes <= 0) return [];

  const start = parseAppWallClock(matchDate, startingTime);
  const end = parseAppWallClock(matchDate, endingTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const times: Date[] = [];
  let currentMs = start.getTime();
  const endMs = end.getTime();
  const stepMs = gapMinutes * 60 * 1000;

  while (currentMs <= endMs) {
    times.push(new Date(currentMs));
    currentMs += stepMs;
  }
  return times;
}

export function formatSchedulePreviewTime(d: Date): string {
  return formatMatchDateTime(d);
}
