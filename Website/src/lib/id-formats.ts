/** Minimum digit width for match numbers (0000–9999). Expands at 10000, 100000, … */
export function matchNumberDigitWidth(n: number): number {
  if (n < 10000) return 4;
  if (n < 100000) return 5;
  if (n < 1000000) return 6;
  return String(Math.max(0, n)).length;
}

export function formatMatchNumber(n: number): string {
  const num = Math.max(0, Math.floor(n));
  return String(num).padStart(matchNumberDigitWidth(num), "0");
}

export function formatMatchLabel(n: number): string {
  return `Match#${formatMatchNumber(n)}`;
}

const MATCH_SUFFIX_RE = /\s*-\s*Match#\d+\s*$/i;

export function stripMatchSuffix(title: string): string {
  return title.replace(MATCH_SUFFIX_RE, "").trim();
}

export function buildMatchTitle(baseTitle: string, matchNumber: number): string {
  const base = stripMatchSuffix(baseTitle.trim());
  return `${base} - ${formatMatchLabel(matchNumber)}`;
}

const TX_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTransactionId(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TX_ID_CHARS[Math.floor(Math.random() * TX_ID_CHARS.length)];
  }
  return out;
}

export function isValidTransactionId(value: string): boolean {
  return /^[A-Z0-9]{10}$/.test(value.trim().toUpperCase());
}
