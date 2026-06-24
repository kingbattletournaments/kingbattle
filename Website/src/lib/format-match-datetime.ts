import { formatInAppTimezone } from "./app-timezone";

function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** e.g. 7th July 2026, 7:00 PM (always shown in IST) */
export function formatMatchDateTime(value: string | Date | null | undefined): string {
  if (!value) return "TBD";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";

  const day = Number(
    formatInAppTimezone(date, { day: "numeric" }),
  );
  const month = formatInAppTimezone(date, { month: "long" });
  const year = formatInAppTimezone(date, { year: "numeric" });
  const time = formatInAppTimezone(date, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${ordinalDay(day)} ${month} ${year}, ${time}`;
}
