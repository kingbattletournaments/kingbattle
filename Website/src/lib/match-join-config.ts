/**
 * Match join: in-game UID requirement (white-label toggle).
 *
 * King Battle (default): only in-game name is required.
 * Other deployments: set MATCH_REQUIRE_IN_GAME_UID=true in env / Vercel.
 *
 * Database columns (in_game_uid, participant_*_uid) are always kept; empty string when optional.
 */

export function isInGameUidRequired(): boolean {
  const v = process.env.MATCH_REQUIRE_IN_GAME_UID?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return false;
}

export function normalizeInGameUid(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

export function validateJoinPlayerDetails(
  inGameName: string | undefined | null,
  inGameUid: string | undefined | null,
): string | null {
  if (!String(inGameName ?? "").trim()) {
    return "In-game name is required";
  }
  if (isInGameUidRequired()) {
    const uid = normalizeInGameUid(inGameUid);
    if (uid.length < 6) {
      return "In-game UID is required (minimum 6 digits)";
    }
  }
  return null;
}
