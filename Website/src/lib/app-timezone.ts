/** Tournament schedule times are entered and shown in India Standard Time. */
export const APP_TIMEZONE = "Asia/Kolkata";
const APP_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD + HH:mm as wall-clock IST → UTC Date. */
export function parseAppWallClock(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm ?? 0, 0, 0) - APP_TZ_OFFSET_MS;
  return new Date(utcMs);
}

/** Parse datetime-local value (YYYY-MM-DDTHH:mm) as wall-clock IST. */
export function parseDateTimeLocal(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  return parseAppWallClock(datePart, timePart.slice(0, 5));
}

/** Normalize any admin-entered schedule string to ISO UTC for storage. */
export function toScheduledAtIso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return parseDateTimeLocal(value).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function formatInAppTimezone(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: APP_TIMEZONE }).format(date);
}
