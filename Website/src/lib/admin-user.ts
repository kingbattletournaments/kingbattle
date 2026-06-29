/** Normalized admin user shape (API may return snake_case or camelCase). */
export type AdminUserRecord = {
  id: string;
  email: string;
  displayName: string;
  coins: number;
  wonCoins?: number;
  isBlocked: boolean;
  blockReason: string | null;
  username?: string;
};

export function normalizeAdminUser(raw: unknown): AdminUserRecord {
  const u = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const wonCoins = Number(u.wonCoins ?? u.won_coins ?? 0);
  const coins = Number(u.coins ?? 0);
  const isBlocked =
    u.isBlocked === true ||
    u.is_blocked === true ||
    u.isBlocked === 1 ||
    u.is_blocked === 1 ||
    u.isBlocked === "true" ||
    u.is_blocked === "true";

  const blockReasonRaw = u.blockReason ?? u.block_reason;
  const blockReason =
    typeof blockReasonRaw === "string" && blockReasonRaw.trim().length > 0
      ? blockReasonRaw.trim()
      : null;

  return {
    id: String(u.id ?? u.username ?? ""),
    email: String(u.email ?? ""),
    displayName: String(u.displayName ?? u.display_name ?? "User"),
    coins,
    wonCoins,
    isBlocked,
    blockReason,
    username: u.username != null ? String(u.username) : undefined,
  };
}

export function serializeAdminUser(user: AdminUserRecord) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    coins: user.coins,
    wonCoins: user.wonCoins ?? 0,
    isBlocked: user.isBlocked,
    is_blocked: user.isBlocked,
    blockReason: user.blockReason,
    block_reason: user.blockReason,
    username: user.username ?? user.id,
  };
}
