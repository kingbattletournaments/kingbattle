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

/** e.g. 7th July 2026, 7:00 PM */
export function formatMatchDateTime(value: string | Date | null | undefined): string {
  if (!value) return "TBD";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";

  const day = ordinalDay(date.getDate());
  const month = date.toLocaleString("en-GB", { month: "long" });
  const year = date.getFullYear();
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${day} ${month} ${year}, ${time}`;
}
