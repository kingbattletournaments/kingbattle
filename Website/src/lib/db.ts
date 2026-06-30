/**
 * Supabase database layer for app_users, deposits, withdrawals, transactions, admins, settings.
 * Use when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 */

import bcrypt from "bcryptjs";
import { getSupabase } from "./supabase";
import type { AppBanner } from "./admin-store";
import {
  ALL_ADMIN_TAB_IDS,
  emptyTabAccess,
  legacyPermissionsFromTabAccess,
  normalizeTabAccess,
  type AdminTabAccess,
} from "./admin-tabs";
import type { DashboardStats } from "./dashboard-stats";
import {
  confirmSlotBookings,
  fetchConfirmedSlotParticipants,
  finishMatchSlotPayouts,
  getMatchSlotAvailability,
  getParticipantCountsForMatches,
  holdMatchSlots,
  refundSlotBookingsForMatch,
} from "./db-match-slots";
import { buildMatchTitle, formatMatchLabel, stripMatchSuffix } from "./id-formats";
import { insertCoinTransaction } from "./coin-transaction-db";
import { buildPaginatedResult, type MatchListStatus, type PaginatedResult } from "./pagination";


// Types matching admin-store
export type DbUser = {
  id: string;
  email: string;
  displayName: string;
  coins: number;
  wonCoins: number;
  isBlocked?: boolean;
  blockReason?: string | null;
  lifetimeEarnedPoints?: number;
  matchesPlayed?: number;
  totalKills?: number;
  avatarUrl?: string;
  createdAt?: string;
  username?: string;
  fcmToken?: string;
};
export type DbDepositRequest = { id: string; userId: string; amount: number; utr: string; status: string; createdAt: string };
export type DbWithdrawalRequest = {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  status: string;
  rejectNote?: string;
  chargePercent?: number;
  createdAt: string;
};
export type DbCoinTransaction = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  referenceId?: string;
  referenceText?: string;
  description?: string;
  createdAt: string;
};
export type DbAdmin = {
  id: string;
  adminname: string;
  passwordHash: string;
  isMasterAdmin: boolean;
  usersAccess: boolean;
  coinsAccess: boolean;
  gamesAccessType: "all" | "specific";
  allowedGameIds: string[];
  tabAccess: AdminTabAccess;
  createdAt: string;
};

function parseStoredTabAccess(raw: unknown): AdminTabAccess | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const merged = emptyTabAccess();
  let any = false;
  for (const id of ALL_ADMIN_TAB_IDS) {
    if (id in record) {
      merged[id] = !!record[id];
      any = true;
    }
  }
  return any ? merged : null;
}

type AdminRow = {
  id: string;
  adminname: string;
  password_hash?: string;
  is_master_admin?: boolean;
  users_access?: boolean;
  coins_access?: boolean;
  games_access_type?: string;
  created_at: string;
  tab_access?: unknown;
};

async function mapAdminRow(admin: AdminRow, passwordHash = "[hidden]"): Promise<DbAdmin> {
  const supabase = getSupabase();
  const { data: games } = supabase
    ? await supabase.from("admin_allowed_games").select("game_id").eq("admin_id", admin.id)
    : { data: [] as { game_id: string }[] };
  const allowedGameIds = (games ?? []).map((g) => g.game_id);
  const storedTabAccess = parseStoredTabAccess(admin.tab_access);
  const partial: DbAdmin = {
    id: admin.id,
    adminname: admin.adminname,
    passwordHash: admin.password_hash ?? passwordHash,
    isMasterAdmin: admin.is_master_admin ?? false,
    usersAccess: admin.users_access ?? false,
    coinsAccess: admin.coins_access ?? false,
    gamesAccessType: (admin.games_access_type as "all" | "specific") ?? "all",
    allowedGameIds,
    tabAccess: storedTabAccess ?? emptyTabAccess(),
    createdAt: admin.created_at,
  };
  return { ...partial, tabAccess: normalizeTabAccess({ ...partial, tabAccess: storedTabAccess }) };
}

export type DbMatch = {
  id: string;
  gameModeId: string;
  title: string;
  entryFee: number;
  roomCode: string | null;
  roomPassword: string | null;
  status: string;
  maxParticipants: number;
  scheduledAt: string;
  registrationLocked: boolean;
  matchType: string;
  prizePool: { coinsPerKill: number; totalPrizePool?: number; rankRewards: { fromRank: number; toRank: number; coins: number }[] };
  map: string;
  image?: string | null;
  participantCount?: number;
  matchNumber?: number;
};

export type DbMatchPreset = {
  id: string;
  gameModeId: string;
  name: string;
  title: string;
  entryFee: number;
  maxParticipants: number;
  matchType: string;
  map: string;
  prizePool: { coinsPerKill: number; totalPrizePool?: number; rankRewards: { fromRank: number; toRank: number; coins: number }[] };
  image?: string | null;
  createdAt?: string;
};

function toMatchPreset(row: {
  id: string;
  game_mode_id: string;
  name: string;
  title: string;
  entry_fee: number;
  max_participants: number;
  match_type?: string;
  map?: string | null;
  coins_per_kill?: number;
  total_prize_pool?: number;
  rank_rewards?: unknown;
  image?: string | null;
  created_at?: string;
}): DbMatchPreset {
  const rewards = Array.isArray(row.rank_rewards)
    ? (row.rank_rewards as { fromRank?: number; toRank?: number; coins?: number }[])
        .filter((r) => r && typeof r.fromRank === "number" && typeof r.toRank === "number" && typeof r.coins === "number")
        .map((r) => ({ fromRank: r.fromRank!, toRank: r.toRank!, coins: r.coins! }))
    : [];
  return {
    id: row.id,
    gameModeId: row.game_mode_id,
    name: row.name,
    title: row.title,
    entryFee: row.entry_fee ?? 0,
    maxParticipants: row.max_participants ?? 16,
    matchType: row.match_type ?? "solo",
    map: row.map ?? "BERMUDA",
    prizePool: {
      coinsPerKill: row.coins_per_kill ?? 5,
      totalPrizePool: row.total_prize_pool ?? 0,
      rankRewards: rewards,
    },
    image: row.image ?? null,
    createdAt: row.created_at,
  };
}

function toMatch(row: {
  id: string;
  game_mode_id: string;
  title: string;
  entry_fee: number;
  room_code?: string | null;
  room_password?: string | null;
  status: string;
  max_participants: number;
  starts_at?: string | null;
  registration_locked?: boolean;
  match_type?: string;
  coins_per_kill?: number;
  total_prize_pool?: number;
  rank_rewards?: unknown;
  map?: string | null;
  image?: string | null;
  match_number?: number | null;
}): DbMatch {
  const rewards = Array.isArray(row.rank_rewards)
    ? (row.rank_rewards as { fromRank?: number; toRank?: number; coins?: number }[])
        .filter((r) => r && typeof r.fromRank === "number" && typeof r.toRank === "number" && typeof r.coins === "number")
        .map((r) => ({ fromRank: r.fromRank!, toRank: r.toRank!, coins: r.coins! }))
    : [];
  return {
    id: row.id,
    gameModeId: row.game_mode_id,
    title: row.title,
    entryFee: row.entry_fee ?? 0,
    roomCode: row.room_code ?? null,
    roomPassword: row.room_password ?? null,
    status: row.status ?? "upcoming",
    maxParticipants: row.max_participants ?? 100,
    scheduledAt: row.starts_at ?? "",
    registrationLocked: row.registration_locked ?? false,
    matchType: row.match_type ?? "solo",
    prizePool: {
      coinsPerKill: row.coins_per_kill ?? 5,
      totalPrizePool: row.total_prize_pool ?? 0,
      rankRewards: rewards,
    },
    map: row.map ?? "BERMUDA",
    image: row.image ?? null,
    matchNumber: row.match_number ?? undefined,
  };
}

function toUser(row: {
  username?: string;
  email: string;
  display_name: string;
  coins: number;
  won_coins?: number;
  is_blocked?: boolean;
  block_reason?: string | null;
  lifetime_earned_points?: number;
  matches_played?: number;
  total_kills?: number;
  avatar_url?: string;
  created_at?: string;
  fcm_token?: string;
}): DbUser {
  return {
    id: row.username ?? "",
    email: row.email,
    displayName: row.display_name,
    coins: (row.coins ?? 0) + (row.won_coins ?? 0),
    wonCoins: row.won_coins ?? 0,
    isBlocked: row.is_blocked ?? false,
    blockReason: row.block_reason ?? null,
    lifetimeEarnedPoints: row.lifetime_earned_points ?? 0,
    matchesPlayed: row.matches_played ?? 0,
    totalKills: row.total_kills ?? 0,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    username: row.username,
    fcmToken: row.fcm_token,
  };
}

function toDepositRequest(row: { id: string; user_id: string; amount: number; utr: string; status: string; created_at: string }): DbDepositRequest {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    utr: row.utr,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toWithdrawalRequest(row: {
  id: string;
  user_id: string;
  amount: number;
  upi_id: string;
  status: string;
  reject_note?: string;
  charge_percent?: number;
  created_at: string;
}): DbWithdrawalRequest {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    upiId: row.upi_id,
    status: row.status,
    rejectNote: row.reject_note,
    chargePercent: row.charge_percent != null ? Number(row.charge_percent) : undefined,
    createdAt: row.created_at,
  };
}

function toTransaction(row: {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  reference_id?: string;
  reference_text?: string;
  description?: string;
  created_at: string;
}): DbCoinTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    type: row.type,
    referenceId: row.reference_id,
    referenceText: row.reference_text,
    description: row.description,
    createdAt: row.created_at,
  };
}

async function allocateMatchNumber(): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const KEY = "next_match_number";
  const { data: row } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  let next = row?.value != null ? parseInt(String(row.value), 10) : Number.NaN;
  if (!Number.isFinite(next) || next < 0) {
    const { data: maxRow } = await supabase
      .from("matches")
      .select("match_number")
      .order("match_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    next = typeof maxRow?.match_number === "number" ? maxRow.match_number + 1 : 0;
  }
  await supabase.from("app_settings").upsert(
    { key: KEY, value: String(next + 1), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  return next;
}

async function matchWinDescription(matchId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return `Winning with match ${matchId}`;
  const { data } = await supabase.from("matches").select("match_number").eq("id", matchId).maybeSingle();
  if (typeof data?.match_number === "number") return `Winning ${formatMatchLabel(data.match_number)}`;
  return `Winning with match ${matchId}`;
}

export const db = {
  async getDefaultGameId(): Promise<string> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Database not configured");
    const { data } = await supabase.from("games").select("id").eq("name", "Free Fire").maybeSingle();
    if (data?.id) return data.id;
    const { data: newGame, error } = await supabase
      .from("games")
      .insert({ name: "Free Fire" })
      .select("id")
      .single();
    if (error || !newGame) throw new Error(error?.message || "Failed to create default game");
    return newGame.id;
  },

  async getAnnouncementText(): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "announcement_text").maybeSingle();
    if (error) return null;
    return data?.value || null;
  },

  async setAnnouncementText(text: string | null): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    await supabase.from("app_settings").upsert({ key: "announcement_text", value: text ?? "", updated_at: new Date().toISOString() }, { onConflict: "key" });
    return text;
  },

  async getBannerImageUrl(): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "banner_image_url").maybeSingle();
    if (error) return null;
    return data?.value || null;
  },

  async setBannerImageUrl(url: string | null): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    await supabase.from("app_settings").upsert({ key: "banner_image_url", value: url ?? "", updated_at: new Date().toISOString() }, { onConflict: "key" });
    return url;
  },

  async users(): Promise<DbUser[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase.from("app_users").select("*").order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map(toUser);
  },

  async usersPaginated(opts: {
    page: number;
    pageSize: number;
    search?: string;
    blocked?: "all" | "blocked" | "active";
  }): Promise<PaginatedResult<DbUser>> {
    const supabase = getSupabase();
    if (!supabase) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    let q = supabase.from("app_users").select("*", { count: "exact" }).order("created_at", { ascending: false });
    const search = opts.search?.trim();
    if (search) {
      const safe = search.replace(/[%_,]/g, "");
      q = q.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
    if (opts.blocked === "blocked") q = q.eq("is_blocked", true);
    if (opts.blocked === "active") q = q.eq("is_blocked", false);
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    return buildPaginatedResult((data ?? []).map(toUser), count ?? 0, opts.page, opts.pageSize);
  },

  async addUser(email: string, displayName: string, password: string, username?: string, referredBy?: string): Promise<DbUser | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    if (!password || password.length < 6) return null;
    const { data: existing } = await supabase.from("app_users").select("username").ilike("email", email).maybeSingle();
    if (existing) return null;

    const { data: bonusRow } = await supabase.from("app_settings").select("value").eq("key", "signup_bonus").single();
    const bonus = bonusRow?.value ? parseInt(bonusRow.value, 10) : 0;

    // Check unique username or generate one
    let finalUsername = username?.trim();
    if (!finalUsername) {
      const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      finalUsername = base;
      let attempt = 1;
      while (true) {
        const { data } = await supabase.from("app_users").select("username").eq("username", finalUsername).maybeSingle();
        if (!data) break;
        finalUsername = `${base}${attempt++}`;
      }
    } else {
      const { data } = await supabase.from("app_users").select("username").eq("username", finalUsername).maybeSingle();
      if (data) return null; // Username already taken
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("app_users")
      .insert({
        email,
        display_name: displayName,
        coins: Math.max(0, bonus),
        won_coins: 0,
        password_hash: passwordHash,
        lifetime_earned_points: 0,
        matches_played: 0,
        total_kills: 0,
        username: finalUsername
      })
      .select()
      .single();
    if (error) return null;

    if (bonus > 0) {
      await insertCoinTransaction(supabase, {
        user_id: finalUsername,
        amount: bonus,
        type: "signup_bonus",
        description: "Signup bonus",
      });
    }

    // Process referral
    const { data: enabledRow } = await supabase.from("app_settings").select("value").eq("key", "referral_system_enabled").maybeSingle();
    const isReferralEnabled = enabledRow?.value === "true";
    if (isReferralEnabled && referredBy) {
      const { data: referrer } = await supabase.from("app_users").select("username, coins").eq("username", referredBy.trim()).maybeSingle();
      if (referrer) {
        const { data: rewardRow } = await supabase.from("app_settings").select("value").eq("key", "referral_reward_coins").maybeSingle();
        const rewardCoins = rewardRow?.value ? parseInt(rewardRow.value, 10) : 0;

        await supabase.from("app_referrals").insert({
          referrer_id: referrer.username,
          referred_id: finalUsername,
          reward_coins: rewardCoins,
          reward_granted: true
        });

        if (rewardCoins > 0) {
          await supabase.from("app_users").update({ coins: referrer.coins + rewardCoins }).eq("username", referrer.username);
          await insertCoinTransaction(supabase, {
            user_id: referrer.username,
            amount: rewardCoins,
            type: "admin_add",
            description: `Referral reward for referring ${displayName}`,
          });
        }
      }
    }

    return toUser(user);
  },

  async syncGoogleUser(id: string, email: string, displayName: string, avatarUrl: string): Promise<DbUser | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: existing } = await supabase.from("app_users").select("*").eq("email", email).maybeSingle();
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("app_users")
        .update({ display_name: displayName, avatar_url: avatarUrl })
        .eq("email", email)
        .select()
        .single();
      if (updateError) {
        console.error("Error updating Google user in db:", updateError);
      }
      return updated ? toUser(updated) : toUser(existing);
    }

    // New Google User signup - add signup bonus
    const { data: bonusRow } = await supabase.from("app_settings").select("value").eq("key", "signup_bonus").single();
    const bonus = bonusRow?.value ? parseInt(bonusRow.value, 10) : 0;

    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    let finalUsername = baseUsername;
    let attempt = 1;
    while (true) {
      const { data } = await supabase.from("app_users").select("username").eq("username", finalUsername).maybeSingle();
      if (!data) break;
      finalUsername = `${baseUsername}${attempt++}`;
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .insert({
        email,
        display_name: displayName,
        coins: Math.max(0, bonus),
        won_coins: 0,
        avatar_url: avatarUrl,
        lifetime_earned_points: 0,
        matches_played: 0,
        total_kills: 0,
        username: finalUsername
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting Google user in db:", error);
      return null;
    }

    if (bonus > 0) {
      try {
        await insertCoinTransaction(supabase, {
          user_id: finalUsername,
          amount: bonus,
          type: "signup_bonus",
          description: "Signup bonus",
        });
      } catch (txError) {
        console.error("Error inserting signup bonus tx:", txError);
      }
    }

    return toUser(user);
  },

  async signInUser(email: string, password: string): Promise<DbUser | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const query = email.trim();
    const { data } = await supabase
      .from("app_users")
      .select("*")
      .or(`email.ilike.${query},username.eq.${query}`)
      .maybeSingle();
    if (!data) return null;
    const u = data as { password_hash?: string | null; is_blocked?: boolean };
    if (u.is_blocked) return null;
    const hash = u.password_hash;
    if (!hash) return null;
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return null;
    return toUser(data);
  },

  async getUser(id: string): Promise<DbUser | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.from("app_users").select("*").eq("username", id).maybeSingle();
    return data ? toUser(data) : null;
  },

  async addCoins(userId: string, amount: number, description?: string): Promise<DbUser | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: user } = await supabase.from("app_users").select("coins").eq("username", userId).single();
    if (!user) return null;
    await supabase.from("app_users").update({ coins: user.coins + amount }).eq("username", userId);
    await insertCoinTransaction(supabase, {
      user_id: userId,
      amount,
      type: "admin_add",
      description: description ?? "Admin added coins",
    });
    return db.getUser(userId);
  },

  async addMatchWinnings(userId: string, amount: number, matchId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { data: user } = await supabase.from("app_users").select("won_coins, lifetime_earned_points").eq("username", userId).single();
    if (!user) return false;
    await supabase.from("app_users").update({
      won_coins: (user.won_coins ?? 0) + amount,
      lifetime_earned_points: (user.lifetime_earned_points ?? 0) + amount
    }).eq("username", userId);
    await insertCoinTransaction(supabase, {
      user_id: userId,
      amount,
      type: "match_winning",
      reference_id: matchId,
      description: await matchWinDescription(matchId),
    });
    return true;
  },

  async blockUser(userId: string, reason: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const trimmed = reason.trim();
    if (!trimmed) return false;

    const withReason = await supabase
      .from("app_users")
      .update({ is_blocked: true, block_reason: trimmed })
      .eq("username", userId)
      .select("username")
      .maybeSingle();

    if (!withReason.error && withReason.data) return true;

    const blockedOnly = await supabase
      .from("app_users")
      .update({ is_blocked: true })
      .eq("username", userId)
      .select("username")
      .maybeSingle();

    return !blockedOnly.error && !!blockedOnly.data;
  },

  async unblockUser(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    const withReason = await supabase
      .from("app_users")
      .update({ is_blocked: false, block_reason: null })
      .eq("username", userId)
      .select("username")
      .maybeSingle();

    if (!withReason.error && withReason.data) return true;

    const blockedOnly = await supabase
      .from("app_users")
      .update({ is_blocked: false })
      .eq("username", userId)
      .select("username")
      .maybeSingle();

    return !blockedOnly.error && !!blockedOnly.data;
  },

  async deleteUser(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("app_users").delete().eq("username", userId);
    return !error;
  },

  async getDepositRequests(status?: "pending" | "accepted" | "rejected"): Promise<DbDepositRequest[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase.from("app_deposit_requests").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data } = await q;
    return (data ?? []).map(toDepositRequest);
  },

  async getDepositRequest(id: string): Promise<DbDepositRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.from("app_deposit_requests").select("*").eq("id", id).single();
    return data ? toDepositRequest(data) : null;
  },

  async getDepositRequestsByUser(userId: string): Promise<DbDepositRequest[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data } = await supabase
      .from("app_deposit_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map(toDepositRequest);
  },

  async addDepositRequest(userId: string, amount: number, utr: string): Promise<DbDepositRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: existing } = await supabase
      .from("app_deposit_requests")
      .select("id")
      .eq("utr", utr.trim())
      .limit(1)
      .maybeSingle();
    if (existing) return null;
    const { data, error } = await supabase
      .from("app_deposit_requests")
      .insert({ user_id: userId, amount, utr, status: "pending" })
      .select()
      .single();
    if (error) {
      console.error("addDepositRequest failed:", error.message);
      return null;
    }
    return toDepositRequest(data);
  },

  async acceptDepositRequest(id: string): Promise<DbDepositRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: req } = await supabase.from("app_deposit_requests").select("*").eq("id", id).eq("status", "pending").single();
    if (!req) return null;
    await supabase.from("app_deposit_requests").update({ status: "accepted" }).eq("id", id);
    const { data: user } = await supabase.from("app_users").select("coins").eq("username", req.user_id).single();
    if (user) {
      await supabase.from("app_users").update({ coins: user.coins + req.amount }).eq("username", req.user_id);
      await insertCoinTransaction(supabase, {
        user_id: req.user_id,
        amount: req.amount,
        type: "deposit",
        description: "Deposited",
        reference_text: req.utr,
      });
    }
    return db.getDepositRequest(id);
  },

  async rejectDepositRequest(id: string): Promise<DbDepositRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: req } = await supabase.from("app_deposit_requests").select("*").eq("id", id).eq("status", "pending").single();
    if (!req) return null;
    await supabase.from("app_deposit_requests").update({ status: "rejected" }).eq("id", id);
    await insertCoinTransaction(supabase, {
      user_id: req.user_id,
      amount: req.amount,
      type: "deposit_failed",
      description: "Deposit rejected",
      reference_text: req.utr,
    });
    return db.getDepositRequest(id);
  },

  async blockDepositRequest(id: string): Promise<DbDepositRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: req } = await supabase.from("app_deposit_requests").select("*").eq("id", id).eq("status", "pending").single();
    if (!req) return null;
    await supabase.from("app_deposit_requests").update({ status: "rejected" }).eq("id", id);
    await supabase.from("app_users").update({ is_blocked: true }).eq("username", req.user_id);
    await insertCoinTransaction(supabase, {
      user_id: req.user_id,
      amount: req.amount,
      type: "deposit_failed",
      description: "Deposit rejected (user blocked)",
      reference_text: req.utr,
    });
    return db.getDepositRequest(id);
  },

  async getWithdrawalCharge(): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "withdrawal_charge").maybeSingle();
    if (error || !data?.value) return 0;
    const n = Number(String(data.value).trim());
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  },

  async setWithdrawalCharge(percent: number): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const p = Math.max(0, Math.min(100, percent));
    await supabase.from("app_settings").upsert({ key: "withdrawal_charge", value: String(p), updated_at: new Date().toISOString() }, { onConflict: "key" });
    return p;
  },

  async getWithdrawalRequests(status?: "pending" | "accepted" | "rejected"): Promise<DbWithdrawalRequest[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase.from("app_withdrawal_requests").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data } = await q;
    return (data ?? []).map(toWithdrawalRequest);
  },

  async getWithdrawalRequest(id: string): Promise<DbWithdrawalRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.from("app_withdrawal_requests").select("*").eq("id", id).single();
    return data ? toWithdrawalRequest(data) : null;
  },

  async getWithdrawalRequestsByUser(userId: string): Promise<DbWithdrawalRequest[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data } = await supabase.from("app_withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return (data ?? []).map(toWithdrawalRequest);
  },

  async addWithdrawalRequest(userId: string, amount: number, upiId: string): Promise<DbWithdrawalRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: user } = await supabase.from("app_users").select("won_coins").eq("username", userId).single();
    if (!user || (user.won_coins ?? 0) < amount) return null;
    const charge = await db.getWithdrawalCharge();
    await supabase.from("app_users").update({ won_coins: (user.won_coins ?? 0) - amount }).eq("username", userId);
    const { data, error } = await supabase
      .from("app_withdrawal_requests")
      .insert({ user_id: userId, amount, upi_id: upiId, status: "pending", charge_percent: charge })
      .select()
      .single();
    if (error) {
      await supabase.from("app_users").update({ won_coins: user.won_coins ?? 0 }).eq("username", userId);
      return null;
    }
    return toWithdrawalRequest(data);
  },

  async acceptWithdrawalRequest(id: string): Promise<DbWithdrawalRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: req } = await supabase.from("app_withdrawal_requests").select("*").eq("id", id).eq("status", "pending").single();
    if (!req) return null;
    await supabase.from("app_withdrawal_requests").update({ status: "accepted" }).eq("id", id);
    await insertCoinTransaction(supabase, {
      user_id: req.user_id,
      amount: -req.amount,
      type: "withdraw",
      description: "Withdraw",
      reference_text: req.upi_id,
    });
    return db.getWithdrawalRequest(id);
  },

  async rejectWithdrawalRequest(id: string, note: string): Promise<DbWithdrawalRequest | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: req } = await supabase.from("app_withdrawal_requests").select("*").eq("id", id).eq("status", "pending").single();
    if (!req) return null;
    const { data: user } = await supabase.from("app_users").select("won_coins").eq("username", req.user_id).single();
    if (user) {
      await supabase.from("app_users").update({ won_coins: (user.won_coins ?? 0) + req.amount }).eq("username", req.user_id);
    }
    await supabase.from("app_withdrawal_requests").update({ status: "rejected", reject_note: note }).eq("id", id);
    await insertCoinTransaction(supabase, {
      user_id: req.user_id,
      amount: req.amount,
      type: "refund",
      description: note?.trim() ? `Withdrawal rejected: ${note.trim()}` : "Withdrawal rejected - refunded",
      reference_text: req.upi_id,
    });
    return db.getWithdrawalRequest(id);
  },

  async transactions(userId?: string): Promise<DbCoinTransaction[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase.from("app_coin_transactions").select("*").order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q;
    return (data ?? []).map(toTransaction);
  },

  async transactionsPaginated(opts: {
    page: number;
    pageSize: number;
    id?: string;
    userId?: string;
  }): Promise<PaginatedResult<DbCoinTransaction & { userDisplayName?: string; userEmail?: string }>> {
    const supabase = getSupabase();
    if (!supabase) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    let q = supabase.from("app_coin_transactions").select("*", { count: "exact" }).order("created_at", { ascending: false });
    const txId = opts.id?.trim().toUpperCase();
    if (txId) q = q.eq("id", txId);
    if (opts.userId?.trim()) q = q.eq("user_id", opts.userId.trim());
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    const items = (data ?? []).map(toTransaction);
    const userIds = Array.from(new Set(items.map((t) => t.userId)));
    const nameByUser = new Map<string, { displayName: string; email: string }>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("app_users")
        .select("username, display_name, email")
        .in("username", userIds);
      for (const u of users ?? []) {
        nameByUser.set(u.username, { displayName: u.display_name, email: u.email });
      }
    }
    const enriched = items.map((t) => ({
      ...t,
      userDisplayName: nameByUser.get(t.userId)?.displayName,
      userEmail: nameByUser.get(t.userId)?.email,
    }));
    return buildPaginatedResult(enriched, count ?? 0, opts.page, opts.pageSize);
  },

  async depositRequestsPaginated(opts: {
    page: number;
    pageSize: number;
    status?: "pending" | "accepted" | "rejected";
  }): Promise<PaginatedResult<DbDepositRequest>> {
    const supabase = getSupabase();
    if (!supabase) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    let q = supabase.from("app_deposit_requests").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (opts.status) q = q.eq("status", opts.status);
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    return buildPaginatedResult((data ?? []).map(toDepositRequest), count ?? 0, opts.page, opts.pageSize);
  },

  async withdrawalRequestsPaginated(opts: {
    page: number;
    pageSize: number;
    status?: "pending" | "accepted" | "rejected";
  }): Promise<PaginatedResult<DbWithdrawalRequest>> {
    const supabase = getSupabase();
    if (!supabase) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    let q = supabase.from("app_withdrawal_requests").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (opts.status) q = q.eq("status", opts.status);
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    return buildPaginatedResult((data ?? []).map(toWithdrawalRequest), count ?? 0, opts.page, opts.pageSize);
  },

  async getSignupBonus(): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const { data } = await supabase.from("app_settings").select("value").eq("key", "signup_bonus").single();
    return data?.value ? parseInt(data.value, 10) : 0;
  },

  async setSignupBonus(amount: number): Promise<number> {
    const supabase = getSupabase();
    if (!supabase) return 0;
    const a = Math.max(0, amount);
    await supabase.from("app_settings").upsert({ key: "signup_bonus", value: String(a), updated_at: new Date().toISOString() }, { onConflict: "key" });
    return a;
  },

  async getDepositQrUrl(): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "deposit_qr_url").maybeSingle();
    if (error) return null;
    const v = data?.value?.trim();
    return v || null;
  },

  async setDepositQrUrl(url: string | null): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    await supabase.from("app_settings").upsert({ key: "deposit_qr_url", value: url ?? "", updated_at: new Date().toISOString() }, { onConflict: "key" });
    return url;
  },

  async getCustomerSupportUrl(): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "customer_support_url").maybeSingle();
    if (error) return null;
    const v = data?.value?.trim();
    return v || null;
  },

  async setCustomerSupportUrl(url: string | null): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    await supabase.from("app_settings").upsert({ key: "customer_support_url", value: url ?? "", updated_at: new Date().toISOString() }, { onConflict: "key" });
    return url || null;
  },

  async games(adminId?: string): Promise<{ id: string; name: string; imageUrl: string | null }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const q = supabase.from("games").select("id, name, image_url").order("display_order").order("created_at");
    const { data, error } = await q;
    if (error) return [];
    let list = (data ?? []).map((r) => ({ id: r.id, name: r.name, imageUrl: r.image_url ?? null }));
    if (adminId) {
      const admin = await db.getAdminById(adminId);
      if (admin && admin.gamesAccessType === "specific" && !admin.isMasterAdmin && admin.allowedGameIds.length > 0) {
        list = list.filter((g) => admin.allowedGameIds.includes(g.id));
      }
    }
    return list;
  },

  async gameModes(gameId?: string): Promise<{ id: string; gameId: string; name: string; imageUrl: string | null }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase.from("game_modes").select("id, game_id, name, image_url").order("display_order").order("created_at");
    if (gameId) q = q.eq("game_id", gameId);
    const { data } = await q;
    return (data ?? []).map((r) => ({ id: r.id, gameId: r.game_id, name: r.name, imageUrl: r.image_url ?? null }));
  },

  async getMode(id: string): Promise<{ id: string; gameId: string; name: string; imageUrl: string | null } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.from("game_modes").select("id, game_id, name, image_url").eq("id", id).single();
    return data ? { id: data.id, gameId: data.game_id, name: data.name, imageUrl: data.image_url ?? null } : null;
  },

  async addGame(name: string, imageUrl: string | null): Promise<{ id: string; name: string; imageUrl: string | null } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("games").insert({ name, image_url: imageUrl }).select("id, name, image_url").single();
    if (error || !data) {
      console.error("addGame failed:", error?.message ?? "no data returned");
      return null;
    }
    return { id: data.id, name: data.name, imageUrl: data.image_url ?? null };
  },

  async deleteGame(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("games").delete().eq("id", id);
    return !error;
  },

  async renameGame(id: string, name: string): Promise<{ id: string; name: string; imageUrl: string | null } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("games").update({ name, updated_at: new Date().toISOString() }).eq("id", id).select("id, name, image_url").single();
    if (error || !data) return null;
    return { id: data.id, name: data.name, imageUrl: data.image_url ?? null };
  },

  async addGameMode(gameId: string, name: string, imageUrl: string | null): Promise<{ id: string; gameId: string; name: string; imageUrl: string | null } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("game_modes").insert({ game_id: gameId, name, image_url: imageUrl }).select("id, game_id, name, image_url").single();
    if (error || !data) {
      console.error("addGameMode failed:", error?.message ?? "no data returned");
      return null;
    }
    return { id: data.id, gameId: data.game_id, name: data.name, imageUrl: data.image_url ?? null };
  },

  async deleteGameMode(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("game_modes").delete().eq("id", id);
    return !error;
  },

  async renameGameMode(id: string, name: string): Promise<{ id: string; gameId: string; name: string; imageUrl: string | null } | null> {
    return db.updateGameMode(id, { name });
  },

  async updateGameMode(
    id: string,
    updates: { name?: string; imageUrl?: string | null }
  ): Promise<{ id: string; gameId: string; name: string; imageUrl: string | null } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const payload: { name?: string; image_url?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
    const { data, error } = await supabase
      .from("game_modes")
      .update(payload)
      .eq("id", id)
      .select("id, game_id, name, image_url")
      .single();
    if (error || !data) {
      console.error("updateGameMode failed:", error?.message ?? "no data returned");
      return null;
    }
    return { id: data.id, gameId: data.game_id, name: data.name, imageUrl: data.image_url ?? null };
  },

  async matches(modeId?: string): Promise<DbMatch[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase
      .from("matches")
      .select("*")
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true, nullsFirst: false });
    if (modeId) q = q.eq("game_mode_id", modeId);
    const { data } = await q;
    if (!data) return [];
    const matchesList = data.map(toMatch);
    const matchIds = matchesList.map((m) => m.id);
    if (matchIds.length === 0) return matchesList;

    const countMap = await getParticipantCountsForMatches(matchIds);
    for (const m of matchesList) {
      m.participantCount = countMap[m.id] ?? 0;
    }
    return matchesList;
  },

  async getJoinedMatchIdsForUser(userId: string): Promise<string[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const ids = new Set<string>();
    const { data: parts } = await supabase
      .from("app_match_participants")
      .select("match_id")
      .eq("app_user_id", userId);
    for (const r of parts ?? []) {
      if (r.match_id) ids.add(r.match_id as string);
    }
    const { data: txs } = await supabase
      .from("app_coin_transactions")
      .select("reference_id")
      .eq("user_id", userId)
      .eq("type", "match_entry");
    for (const t of txs ?? []) {
      if (t.reference_id) ids.add(t.reference_id as string);
    }
    return Array.from(ids);
  },

  async matchesPaginated(opts: {
    modeId: string;
    page: number;
    pageSize: number;
    status: MatchListStatus;
  }): Promise<PaginatedResult<DbMatch>> {
    const supabase = getSupabase();
    if (!supabase) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    let q = supabase
      .from("matches")
      .select("*", { count: "exact" })
      .neq("status", "cancelled")
      .eq("game_mode_id", opts.modeId);
    if (opts.status === "ongoing") q = q.eq("status", "ongoing");
    else if (opts.status === "upcoming") q = q.eq("status", "upcoming");
    else q = q.in("status", ["completed", "ended", "finished"]);
    const ascending = opts.status !== "completed";
    q = q.order("starts_at", { ascending, nullsFirst: false });
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    const matchesList = (data ?? []).map(toMatch);
    const matchIds = matchesList.map((m) => m.id);
    if (matchIds.length > 0) {
      const countMap = await getParticipantCountsForMatches(matchIds);
      for (const m of matchesList) {
        m.participantCount = countMap[m.id] ?? 0;
      }
    }
    return buildPaginatedResult(matchesList, count ?? 0, opts.page, opts.pageSize);
  },

  async matchesPaginatedForUser(opts: {
    userId: string;
    page: number;
    pageSize: number;
    status: MatchListStatus;
  }): Promise<PaginatedResult<DbMatch>> {
    const supabase = getSupabase();
    if (!supabase) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    const joinedIds = await db.getJoinedMatchIdsForUser(opts.userId);
    if (joinedIds.length === 0) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    let q = supabase
      .from("matches")
      .select("*", { count: "exact" })
      .neq("status", "cancelled")
      .in("id", joinedIds);
    if (opts.status === "ongoing") q = q.eq("status", "ongoing");
    else if (opts.status === "upcoming") q = q.eq("status", "upcoming");
    else q = q.in("status", ["completed", "ended", "finished"]);
    const ascending = opts.status !== "completed";
    q = q.order("starts_at", { ascending, nullsFirst: false });
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) return buildPaginatedResult([], 0, opts.page, opts.pageSize);
    const matchesList = (data ?? []).map(toMatch);
    const matchIds = matchesList.map((m) => m.id);
    if (matchIds.length > 0) {
      const countMap = await getParticipantCountsForMatches(matchIds);
      for (const m of matchesList) {
        m.participantCount = countMap[m.id] ?? 0;
      }
    }
    return buildPaginatedResult(matchesList, count ?? 0, opts.page, opts.pageSize);
  },

  async addMatch(
    gameModeId: string,
    title: string,
    entryFee: number,
    maxParticipants: number,
    scheduledAt: string,
    matchType: string,
    prizePool: { coinsPerKill: number; totalPrizePool?: number; rankRewards: { fromRank: number; toRank: number; coins: number }[] },
    map?: string,
    image?: string | null
  ): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const matchNumber = await allocateMatchNumber();
    const displayTitle = buildMatchTitle(title, matchNumber);
    const row: Record<string, unknown> = {
      game_mode_id: gameModeId,
      title: displayTitle,
      entry_fee: entryFee,
      max_participants: maxParticipants,
      starts_at: scheduledAt || null,
      status: "upcoming",
      match_type: matchType || "solo",
      coins_per_kill: prizePool?.coinsPerKill ?? 5,
      total_prize_pool: prizePool?.totalPrizePool ?? 0,
      rank_rewards: prizePool?.rankRewards ?? [],
      map: map || "BERMUDA",
      image: image || null,
      match_number: matchNumber,
    };
    let { data, error } = await supabase.from("matches").insert(row).select().single();
    if (error && String(error.message).includes("match_number")) {
      delete row.match_number;
      ({ data, error } = await supabase.from("matches").insert(row).select().single());
    }
    if (error || !data) {
      console.error("addMatch failed:", error?.message ?? "no data returned");
      return null;
    }
    const match = toMatch(data);
    if (match.matchNumber == null) match.matchNumber = matchNumber;
    return match;
  },

  async getMatch(id: string): Promise<(DbMatch & { participants?: { id: string; matchId: string; userId: string; teamMembers: { inGameName: string; inGameUid: string; kills?: number }[]; joinedAt: string; rank?: number }[] }) | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: matchRow, error } = await supabase.from("matches").select("*").eq("id", id).single();
    if (error || !matchRow) return null;
    const { data: parts } = await supabase
      .from("match_participants")
      .select("id, match_id, user_id, in_game_name, in_game_uid, kills, squad_rank, joined_at")
      .eq("match_id", id)
      .order("joined_at", { ascending: true });
    const { data: appParts, error: appPartsError } = await supabase
      .from("app_match_participants")
      .select(
        "id, match_id, app_user_id, in_game_name, in_game_uid, kills, squad_rank, joined_at, participant_2_name, participant_2_uid, participant_3_name, participant_3_uid, participant_4_name, participant_4_uid",
      )
      .eq("match_id", id)
      .order("joined_at", { ascending: true });
    const appPartsSafe = appPartsError ? [] : (appParts ?? []);
    const appRowToTeamMembers = (p: {
      in_game_name: string;
      in_game_uid: string;
      kills?: number | null;
      participant_2_name?: string | null;
      participant_2_uid?: string | null;
      participant_3_name?: string | null;
      participant_3_uid?: string | null;
      participant_4_name?: string | null;
      participant_4_uid?: string | null;
    }) => {
      const leaderKills = p.kills ?? 0;
      const members: { inGameName: string; inGameUid: string; kills?: number }[] = [
        { inGameName: p.in_game_name, inGameUid: p.in_game_uid, kills: leaderKills },
      ];
      const extras: [string | null | undefined, string | null | undefined][] = [
        [p.participant_2_name, p.participant_2_uid],
        [p.participant_3_name, p.participant_3_uid],
        [p.participant_4_name, p.participant_4_uid],
      ];
      for (const [n, u] of extras) {
        const nn = (n ?? "").trim();
        const uu = (u ?? "").trim();
        if (nn && uu) {
          members.push({ inGameName: nn, inGameUid: uu, kills: 0 });
        }
      }
      return members;
    };
    const slotParticipants = await fetchConfirmedSlotParticipants(id);
    const participants =
      slotParticipants.length > 0
        ? slotParticipants
        : [
            ...(parts ?? []).map((p) => ({
              id: p.id,
              matchId: p.match_id,
              userId: p.user_id,
              teamMembers: [{ inGameName: p.in_game_name, inGameUid: p.in_game_uid, kills: p.kills ?? 0 }],
              joinedAt: p.joined_at,
              rank: p.squad_rank ?? undefined,
            })),
            ...appPartsSafe.map((p) => ({
              id: p.id,
              matchId: p.match_id,
              userId: p.app_user_id,
              teamMembers: appRowToTeamMembers(p),
              joinedAt: p.joined_at,
              rank: (p as { squad_rank?: number }).squad_rank ?? undefined,
            })),
          ];
    const countMap = await getParticipantCountsForMatches([id]);
    return { ...toMatch(matchRow), participants, participantCount: countMap[id] ?? 0 };
  },

  getMatchSlotAvailability,
  holdMatchSlots,
  confirmSlotBookings,

  async joinMatch(
    matchId: string,
    appUserId: string,
    inGameName: string,
    inGameUid: string,
    teamMembers?: { inGameName: string; inGameUid: string }[],
    slotJoin?: {
      holdId: string;
      slots: { slotIndex: number; inGameName: string; inGameUid: string }[];
    },
  ): Promise<{ error?: string } | null> {
    if (slotJoin?.holdId && slotJoin.slots?.length) {
      return confirmSlotBookings(matchId, appUserId, slotJoin.holdId, slotJoin.slots);
    }
    const supabase = getSupabase();
    if (!supabase) return { error: "Database not configured" };
    const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
    if (!match) return { error: "Match not found" };
    if (match.status !== "upcoming") return { error: "Registration closed" };
    if (match.registration_locked) return { error: "Registration locked" };
    const { data: user } = await supabase.from("app_users").select("coins, won_coins, is_blocked").eq("username", appUserId).single();
    if (!user) return { error: "User not found" };
    if (user.is_blocked) return { error: "Account is blocked" };
    const entryFee = match.entry_fee ?? 0;
    const totalBalance = (user.coins ?? 0) + (user.won_coins ?? 0);
    if (totalBalance < entryFee) return { error: "Insufficient coins" };
    const { data: existing } = await supabase
      .from("app_match_participants")
      .select("id")
      .eq("match_id", matchId)
      .eq("app_user_id", appUserId)
      .single();
    if (existing) return { error: "Already registered" };
    const { count: appCount } = await supabase.from("app_match_participants").select("id", { count: "exact", head: true }).eq("match_id", matchId);
    const { count: authCount } = await supabase.from("match_participants").select("id", { count: "exact", head: true }).eq("match_id", matchId);
    const total = (appCount ?? 0) + (authCount ?? 0);
    if (total >= (match.max_participants ?? 100)) return { error: "Match is full" };
    const t2 = teamMembers?.[0];
    const t3 = teamMembers?.[1];
    const t4 = teamMembers?.[2];
    const { error: insertErr } = await supabase.from("app_match_participants").insert({
      match_id: matchId,
      app_user_id: appUserId,
      in_game_name: inGameName,
      in_game_uid: inGameUid,
      participant_2_name: t2?.inGameName ?? null,
      participant_2_uid: t2?.inGameUid ?? null,
      participant_3_name: t3?.inGameName ?? null,
      participant_3_uid: t3?.inGameUid ?? null,
      participant_4_name: t4?.inGameName ?? null,
      participant_4_uid: t4?.inGameUid ?? null,
    });
    if (insertErr) return { error: insertErr.message };
    if (entryFee > 0) {
      let deductCoins = 0;
      let deductWonCoins = 0;
      if ((user.coins ?? 0) >= entryFee) {
        deductCoins = entryFee;
      } else {
        deductCoins = user.coins ?? 0;
        deductWonCoins = entryFee - deductCoins;
      }
      await supabase.from("app_users").update({
        coins: (user.coins ?? 0) - deductCoins,
        won_coins: (user.won_coins ?? 0) - deductWonCoins
      }).eq("username", appUserId);
      await insertCoinTransaction(supabase, {
        user_id: appUserId,
        amount: -entryFee,
        type: "match_entry",
        reference_id: matchId,
        description:
          typeof match.match_number === "number"
            ? `Entry ${formatMatchLabel(match.match_number)}`
            : "Match entry fee",
      });
    }
    return null;
  },

  async updateMatchRoomInfo(id: string, roomCode: string, roomPassword: string): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("matches")
      .update({ room_code: roomCode, room_password: roomPassword, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "upcoming")
      .select()
      .single();
    if (error || !data) return null;
    return toMatch(data);
  },

  async startMatch(id: string, roomCode?: string, roomPassword?: string): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: existing } = await supabase.from("matches").select("room_code, room_password, status").eq("id", id).single();
    if (!existing || existing.status !== "upcoming") return null;
    const rc = roomCode ?? existing.room_code;
    const rp = roomPassword ?? existing.room_password;
    if (!rc || !rp) return null;
    const { data, error } = await supabase
      .from("matches")
      .update({ status: "ongoing", room_code: rc, room_password: rp, registration_locked: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "upcoming")
      .select()
      .single();
    if (error || !data) return null;
    return toMatch(data);
  },

  async cancelMatch(id: string): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: m } = await supabase.from("matches").select("*").eq("id", id).eq("status", "upcoming").single();
    if (!m) return null;
    const entryFee = m.entry_fee ?? 0;
    const title = (m.title as string) ?? "Match";
    const snapshot = toMatch(m);

    if (entryFee > 0) {
      await refundSlotBookingsForMatch(id, entryFee, title);

      const { data: appRows } = await supabase.from("app_match_participants").select("app_user_id").eq("match_id", id);
      const appUserIds = Array.from(new Set((appRows ?? []).map((r: { app_user_id: string }) => r.app_user_id)));
      for (const appUserId of appUserIds) {
        const { data: user } = await supabase.from("app_users").select("coins").eq("username", appUserId).single();
        if (!user || typeof user.coins !== "number") continue;
        await supabase.from("app_users").update({ coins: user.coins + entryFee }).eq("username", appUserId);
        await insertCoinTransaction(supabase, {
          user_id: appUserId,
          amount: entryFee,
          type: "refund",
          reference_id: id,
          description: `Refund: ${title} cancelled`,
        });
      }

      const { data: legacyRows } = await supabase.from("match_participants").select("user_id").eq("match_id", id);
      const legacyUserIds = Array.from(new Set((legacyRows ?? []).map((r: { user_id: string }) => r.user_id)));
      for (const userId of legacyUserIds) {
        const { data: lu } = await supabase.from("users").select("coins").eq("id", userId).single();
        if (!lu || typeof lu.coins !== "number") continue;
        await supabase.from("users").update({ coins: lu.coins + entryFee }).eq("id", userId);
        await supabase.from("coin_transactions").insert({
          user_id: userId,
          amount: entryFee,
          type: "refund",
          reference_id: id,
          description: `Refund: ${title} cancelled`,
        });
      }
    }

    await supabase.from("match_slot_bookings").delete().eq("match_id", id);
    await supabase.from("app_match_participants").delete().eq("match_id", id);
    await supabase.from("match_participants").delete().eq("match_id", id);
    const { error } = await supabase.from("matches").delete().eq("id", id).eq("status", "upcoming");
    if (error) {
      console.error("cancelMatch delete failed:", error.message);
      return null;
    }

    return snapshot;
  },

  async deleteMatch(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    await supabase.from("match_slot_bookings").delete().eq("match_id", id);
    await supabase.from("app_match_participants").delete().eq("match_id", id);
    await supabase.from("match_participants").delete().eq("match_id", id);
    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) {
      console.error("deleteMatch failed:", error.message);
    }
    return !error;
  },

  async renameMatch(id: string, title: string): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const existing = await db.getMatch(id);
    const base = stripMatchSuffix(title);
    const finalTitle =
      existing?.matchNumber != null ? buildMatchTitle(base, existing.matchNumber) : base;
    const { data, error } = await supabase
      .from("matches")
      .update({ title: finalTitle, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return null;
    return toMatch(data);
  },

  async updateMatch(
    id: string,
    updates: {
      title?: string;
      entryFee?: number;
      maxParticipants?: number;
      scheduledAt?: string;
      matchType?: string;
      map?: string;
      image?: string | null;
      prizePool?: {
        coinsPerKill: number;
        totalPrizePool?: number;
        rankRewards: { fromRank: number; toRank: number; coins: number }[];
      };
    },
  ): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const existing = await db.getMatch(id);
    if (!existing || existing.status !== "upcoming") return null;

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) {
      const base = stripMatchSuffix(updates.title);
      payload.title =
        existing.matchNumber != null ? buildMatchTitle(base, existing.matchNumber) : base;
    }
    if (updates.entryFee !== undefined) payload.entry_fee = updates.entryFee;
    if (updates.maxParticipants !== undefined) payload.max_participants = updates.maxParticipants;
    if (updates.scheduledAt !== undefined) payload.starts_at = updates.scheduledAt || null;
    if (updates.matchType !== undefined) payload.match_type = updates.matchType;
    if (updates.map !== undefined) payload.map = updates.map;
    if (updates.image !== undefined) payload.image = updates.image;
    if (updates.prizePool) {
      payload.coins_per_kill = updates.prizePool.coinsPerKill;
      payload.total_prize_pool = updates.prizePool.totalPrizePool ?? 0;
      payload.rank_rewards = updates.prizePool.rankRewards;
    }

    const { data, error } = await supabase.from("matches").update(payload).eq("id", id).select().single();
    if (error || !data) {
      console.error("updateMatch failed:", error?.message ?? "no data returned");
      return null;
    }
    return toMatch(data);
  },

  async updateParticipantKills(
    matchId: string,
    participantId: string,
    kills: number[]
  ): Promise<{ id: string } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const k0 = kills[0] ?? 0;
    const { data: slotRow } = await supabase
      .from("match_slot_bookings")
      .select("id")
      .eq("id", participantId)
      .eq("match_id", matchId)
      .single();
    if (slotRow) {
      const { error } = await supabase
        .from("match_slot_bookings")
        .update({ kills: k0 })
        .eq("id", participantId)
        .eq("match_id", matchId);
      return error ? null : { id: participantId };
    }
    const { data: mp } = await supabase.from("match_participants").select("id").eq("id", participantId).eq("match_id", matchId).single();
    if (mp) {
      const { error } = await supabase.from("match_participants").update({ kills: k0 }).eq("id", participantId).eq("match_id", matchId);
      return error ? null : { id: participantId };
    }
    const { data: amp } = await supabase.from("app_match_participants").select("id").eq("id", participantId).eq("match_id", matchId).single();
    if (amp) {
      const { error } = await supabase.from("app_match_participants").update({ kills: k0 }).eq("id", participantId).eq("match_id", matchId);
      return error ? null : { id: participantId };
    }
    return null;
  },

  async updateParticipantRank(
    matchId: string,
    participantId: string,
    rank: number
  ): Promise<{ id: string } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: slotRow } = await supabase
      .from("match_slot_bookings")
      .select("id")
      .eq("id", participantId)
      .eq("match_id", matchId)
      .single();
    if (slotRow) {
      const { error } = await supabase
        .from("match_slot_bookings")
        .update({ squad_rank: rank })
        .eq("id", participantId)
        .eq("match_id", matchId);
      return error ? null : { id: participantId };
    }
    const { data: mp } = await supabase.from("match_participants").select("id").eq("id", participantId).eq("match_id", matchId).single();
    if (mp) {
      const { error } = await supabase.from("match_participants").update({ squad_rank: rank }).eq("id", participantId).eq("match_id", matchId);
      return error ? null : { id: participantId };
    }
    const { data: amp } = await supabase.from("app_match_participants").select("id").eq("id", participantId).eq("match_id", matchId).single();
    if (amp) {
      const { error } = await supabase.from("app_match_participants").update({ squad_rank: rank }).eq("id", participantId).eq("match_id", matchId);
      return error ? null : { id: participantId };
    }
    return null;
  },

  async bulkUpdateParticipants(
    matchId: string,
    updates: { id: string; kills?: number[]; rank?: number }[],
  ): Promise<boolean> {
    for (const u of updates) {
      if (Array.isArray(u.kills)) {
        const ok = await db.updateParticipantKills(matchId, u.id, u.kills);
        if (!ok) return false;
      }
      if (typeof u.rank === "number" && u.rank >= 1) {
        const ok = await db.updateParticipantRank(matchId, u.id, u.rank);
        if (!ok) return false;
      }
    }
    return true;
  },

  async finishMatch(
    id: string,
    participantUpdates?: { id: string; kills?: number[]; rank?: number }[],
  ): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    if (participantUpdates?.length) {
      const ok = await db.bulkUpdateParticipants(id, participantUpdates);
      if (!ok) return null;
    }
    const match = await db.getMatch(id);
    if (!match || match.status !== "ongoing") return null;
    const participants = match.participants ?? [];
    const prizePool = match.prizePool ?? { coinsPerKill: 0, totalPrizePool: 0, rankRewards: [] };
    const rewards = prizePool.rankRewards ?? [];
    const cpk = prizePool.coinsPerKill ?? 0;

    const usedSlotPayouts = await finishMatchSlotPayouts(
      id,
      match.matchType ?? "solo",
      cpk,
      rewards,
      async (userId, coins, matchId) => {
        await db.addMatchWinnings(userId, coins, matchId);
      },
    );

    if (!usedSlotPayouts) {
      const withRank = participants
        .filter((p) => typeof p.rank === "number" && p.rank >= 1)
        .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
      for (const p of withRank) {
        const totalKills = (p.teamMembers ?? []).reduce((s, t) => s + (t.kills ?? 0), 0);
        let coins = totalKills * cpk;
        for (const r of rewards) {
          if (p.rank! >= r.fromRank && p.rank! <= r.toRank) {
            coins += r.coins;
            break;
          }
        }
        if (coins > 0 && p.userId) {
          await db.addMatchWinnings(p.userId, coins, id);
        }
      }

      for (const p of participants) {
        if (p.userId) {
          const totalKills = (p.teamMembers ?? []).reduce((s, t) => s + (t.kills ?? 0), 0);
          const isAppUser = p.userId.length !== 36;
          if (isAppUser) {
            const { data: userRow } = await supabase.from("app_users").select("matches_played, total_kills").eq("username", p.userId).single();
            if (userRow) {
              await supabase.from("app_users").update({
                matches_played: (userRow.matches_played ?? 0) + 1,
                total_kills: (userRow.total_kills ?? 0) + totalKills,
              }).eq("username", p.userId);
            }
          } else {
            const { data: userRow } = await supabase.from("users").select("matches_played, total_kills").eq("id", p.userId).single();
            if (userRow) {
              await supabase.from("users").update({
                matches_played: (userRow.matches_played ?? 0) + 1,
                total_kills: (userRow.total_kills ?? 0) + totalKills,
              }).eq("id", p.userId);
            }
          }
        }
      }
    }
    const { data, error } = await supabase
      .from("matches")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "ongoing")
      .select()
      .single();
    if (error || !data) return null;
    return toMatch(data);
  },

  async loginAdmin(adminname: string, password: string): Promise<DbAdmin | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: admin } = await supabase.from("admins").select("*").ilike("adminname", adminname).single();
    if (!admin || !admin.password_hash) return null;
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return null;
    return mapAdminRow(admin, admin.password_hash);
  },

  async getAdminById(id: string): Promise<DbAdmin | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: admin } = await supabase.from("admins").select("*").eq("id", id).single();
    if (!admin) return null;
    return mapAdminRow(admin);
  },

  async getAllAdmins(): Promise<DbAdmin[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data: admins } = await supabase.from("admins").select("*").not("adminname", "is", null);
    if (!admins) return [];
    const result: DbAdmin[] = [];
    for (const a of admins) {
      result.push(await mapAdminRow(a));
    }
    return result;
  },

  async createAdmin(
    adminname: string,
    password: string,
    opts: { tabAccess: Partial<AdminTabAccess> }
  ): Promise<DbAdmin | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: existing } = await supabase.from("admins").select("id").ilike("adminname", adminname).single();
    if (existing) return null;
    const tabAccess = { ...emptyTabAccess(), ...opts.tabAccess };
    const legacy = legacyPermissionsFromTabAccess(tabAccess);
    const hash = bcrypt.hashSync(password, 10);
    const { data: admin, error } = await supabase
      .from("admins")
      .insert({
        adminname,
        password_hash: hash,
        is_master_admin: false,
        users_access: legacy.usersAccess,
        coins_access: legacy.coinsAccess,
        games_access_type: legacy.gamesAccessType,
        tab_access: tabAccess,
      })
      .select()
      .single();
    if (error || !admin) return null;
    return db.getAdminById(admin.id);
  },

  async deleteAdmin(adminId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { data: admin } = await supabase.from("admins").select("is_master_admin").eq("id", adminId).single();
    if (!admin || admin.is_master_admin) return false;
    await supabase.from("admin_allowed_games").delete().eq("admin_id", adminId);
    const { error } = await supabase.from("admins").delete().eq("id", adminId);
    return !error;
  },

  async updateAdminPassword(adminId: string, newPassword: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const hash = bcrypt.hashSync(newPassword, 10);
    const { error } = await supabase.from("admins").update({ password_hash: hash }).eq("id", adminId);
    return !error;
  },

  async getBanners(): Promise<AppBanner[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("app_banners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      linkUrl: row.link_url,
      displayPlayCarousel: row.display_play_carousel,
      displayEarn: row.display_earn,
      createdAt: row.created_at,
    }));
  },

  async addBanner(
    imageUrl: string,
    linkUrl: string,
    displayPlayCarousel: boolean,
    displayEarn: boolean
  ): Promise<AppBanner | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("app_banners")
      .insert({
        image_url: imageUrl,
        link_url: linkUrl,
        display_play_carousel: displayPlayCarousel,
        display_earn: displayEarn,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("addBanner failed:", error?.message ?? "no data returned");
      return null;
    }
    return {
      id: data.id,
      imageUrl: data.image_url,
      linkUrl: data.link_url,
      displayPlayCarousel: data.display_play_carousel,
      displayEarn: data.display_earn,
      createdAt: data.created_at,
    };
  },

  async updateBanner(
    id: string,
    imageUrl: string,
    linkUrl: string,
    displayPlayCarousel: boolean,
    displayEarn: boolean
  ): Promise<AppBanner | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("app_banners")
      .update({
        image_url: imageUrl,
        link_url: linkUrl,
        display_play_carousel: displayPlayCarousel,
        display_earn: displayEarn,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      imageUrl: data.image_url,
      linkUrl: data.link_url,
      displayPlayCarousel: data.display_play_carousel,
      displayEarn: data.display_earn,
      createdAt: data.created_at,
    };
  },

  async deleteBanner(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("app_banners").delete().eq("id", id);
    return !error;
  },

  async getReferralSettings(): Promise<{ enabled: boolean; rewardCoins: number; bannerUrl: string }> {
    const supabase = getSupabase();
    if (!supabase) return { enabled: false, rewardCoins: 0, bannerUrl: "" };
    const { data: enabledRow } = await supabase.from("app_settings").select("value").eq("key", "referral_system_enabled").maybeSingle();
    const { data: rewardRow } = await supabase.from("app_settings").select("value").eq("key", "referral_reward_coins").maybeSingle();
    const { data: bannerRow } = await supabase.from("app_settings").select("value").eq("key", "referral_banner_url").maybeSingle();
    return {
      enabled: enabledRow?.value === "true",
      rewardCoins: rewardRow?.value ? parseInt(rewardRow.value, 10) : 0,
      bannerUrl: bannerRow?.value || "",
    };
  },

  async setReferralSettings(enabled: boolean, rewardCoins: number, bannerUrl: string): Promise<{ enabled: boolean; rewardCoins: number; bannerUrl: string }> {
    const supabase = getSupabase();
    if (!supabase) return { enabled, rewardCoins, bannerUrl };
    await supabase.from("app_settings").upsert({ key: "referral_system_enabled", value: String(enabled), updated_at: new Date().toISOString() }, { onConflict: "key" });
    await supabase.from("app_settings").upsert({ key: "referral_reward_coins", value: String(rewardCoins), updated_at: new Date().toISOString() }, { onConflict: "key" });
    await supabase.from("app_settings").upsert({ key: "referral_banner_url", value: bannerUrl, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { enabled, rewardCoins, bannerUrl };
  },

  async getReferralsList(): Promise<any[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    
    const { data: referrals, error } = await supabase
      .from("app_referrals")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (error || !referrals) return [];
    
    const userIds = Array.from(new Set([
      ...referrals.map(r => r.referrer_id),
      ...referrals.map(r => r.referred_id)
    ]));
    
    if (userIds.length === 0) return [];
    
    const { data: users } = await supabase
      .from("app_users")
      .select("username, display_name")
      .in("username", userIds);
      
    const userMap = new Map(users?.map(u => [u.username, u.display_name]) ?? []);
    
    return referrals.map((r: any) => ({
      id: r.id,
      referrerId: r.referrer_id,
      referrerName: userMap.get(r.referrer_id) ?? "Unknown",
      referredId: r.referred_id,
      referredName: userMap.get(r.referred_id) ?? "Unknown",
      rewardCoins: r.reward_coins,
      rewardGranted: r.reward_granted,
      createdAt: r.created_at,
    }));
  },

  async updateFcmToken(userId: string, token: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { data, error } = await supabase
      .from("app_users")
      .update({ fcm_token: token })
      .eq("username", userId)
      .select("username");
    if (error) {
      console.error("updateFcmToken failed:", error.message);
      return false;
    }
    if (!data?.length) {
      console.error("updateFcmToken: no user matched username", userId);
      return false;
    }
    return true;
  },

  async clearFcmToken(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from("app_users")
      .update({ fcm_token: null })
      .eq("username", userId);
    if (error) {
      console.error("clearFcmToken failed:", error.message);
      return false;
    }
    return true;
  },

  async clearFcmTokenByValue(token: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from("app_users")
      .update({ fcm_token: null })
      .eq("fcm_token", token);
    if (error) {
      console.error("clearFcmTokenByValue failed:", error.message);
      return false;
    }
    return true;
  },

  async getFcmTokensForTarget(
    target: "all" | "active" | "blocked",
  ): Promise<{ userId: string; token: string }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase
      .from("app_users")
      .select("username, fcm_token, is_blocked")
      .not("fcm_token", "is", null);
    if (target === "active") q = q.eq("is_blocked", false);
    if (target === "blocked") q = q.eq("is_blocked", true);
    const { data, error } = await q;
    if (error || !data) {
      console.error("getFcmTokensForTarget failed:", error?.message ?? "no data");
      return [];
    }
    return data
      .filter((row) => row.fcm_token)
      .map((row) => ({ userId: row.username, token: row.fcm_token as string }));
  },

  async getFcmTokensForUserIds(userIds: string[]): Promise<{ userId: string; token: string }[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) return [];
    const { data, error } = await supabase
      .from("app_users")
      .select("username, fcm_token, is_blocked")
      .in("username", uniqueUserIds)
      .not("fcm_token", "is", null)
      .eq("is_blocked", false);
    if (error || !data) {
      console.error("getFcmTokensForUserIds failed:", error?.message ?? "no data");
      return [];
    }
    return data
      .filter((row) => row.fcm_token)
      .map((row) => ({ userId: row.username as string, token: row.fcm_token as string }));
  },

  async listFcmDeviceRegistrations(): Promise<
    { userId: string; tokenSuffix: string; isBlocked: boolean }[]
  > {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("app_users")
      .select("username, fcm_token, is_blocked")
      .not("fcm_token", "is", null);
    if (error) {
      console.error("listFcmDeviceRegistrations failed:", error.message);
      return [];
    }
    return (data ?? [])
      .filter((row) => row.fcm_token)
      .map((row) => ({
        userId: row.username as string,
        tokenSuffix: String(row.fcm_token).slice(-8),
        isBlocked: Boolean(row.is_blocked),
      }));
  },

  async matchPresets(modeId?: string): Promise<DbMatchPreset[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase.from("match_presets").select("*").order("created_at", { ascending: false });
    if (modeId) q = q.eq("game_mode_id", modeId);
    const { data } = await q;
    if (!data) return [];
    return data.map(toMatchPreset);
  },

  async getMatchPreset(id: string): Promise<DbMatchPreset | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("match_presets").select("*").eq("id", id).single();
    if (error || !data) return null;
    return toMatchPreset(data);
  },

  async addMatchPreset(input: {
    gameModeId: string;
    name: string;
    title: string;
    entryFee: number;
    maxParticipants: number;
    matchType: string;
    map?: string;
    prizePool: { coinsPerKill: number; totalPrizePool?: number; rankRewards: { fromRank: number; toRank: number; coins: number }[] };
    image?: string | null;
  }): Promise<DbMatchPreset | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("match_presets")
      .insert({
        game_mode_id: input.gameModeId,
        name: input.name,
        title: input.title,
        entry_fee: input.entryFee,
        max_participants: input.maxParticipants,
        match_type: input.matchType || "solo",
        map: input.map || "BERMUDA",
        coins_per_kill: input.prizePool?.coinsPerKill ?? 5,
        total_prize_pool: input.prizePool?.totalPrizePool ?? 0,
        rank_rewards: input.prizePool?.rankRewards ?? [],
        image: input.image || null,
      })
      .select()
      .single();
    if (error || !data) {
      console.error("addMatchPreset failed:", error?.message ?? "no data returned");
      return null;
    }
    return toMatchPreset(data);
  },

  async updateMatchPreset(
    id: string,
    updates: Partial<{
      name: string;
      title: string;
      entryFee: number;
      maxParticipants: number;
      matchType: string;
      map: string;
      prizePool: { coinsPerKill: number; totalPrizePool?: number; rankRewards: { fromRank: number; toRank: number; coins: number }[] };
      image: string | null;
    }>,
  ): Promise<DbMatchPreset | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.entryFee !== undefined) payload.entry_fee = updates.entryFee;
    if (updates.maxParticipants !== undefined) payload.max_participants = updates.maxParticipants;
    if (updates.matchType !== undefined) payload.match_type = updates.matchType;
    if (updates.map !== undefined) payload.map = updates.map;
    if (updates.image !== undefined) payload.image = updates.image;
    if (updates.prizePool) {
      payload.coins_per_kill = updates.prizePool.coinsPerKill;
      payload.total_prize_pool = updates.prizePool.totalPrizePool ?? 0;
      payload.rank_rewards = updates.prizePool.rankRewards;
    }
    const { data, error } = await supabase.from("match_presets").update(payload).eq("id", id).select().single();
    if (error || !data) {
      console.error("updateMatchPreset failed:", error?.message ?? "no data returned");
      return null;
    }
    return toMatchPreset(data);
  },

  async deleteMatchPreset(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("match_presets").delete().eq("id", id);
    return !error;
  },

  async createMatchesFromPreset(
    presetId: string,
    gameModeId: string,
    scheduledAtList: string[],
  ): Promise<DbMatch[] | null> {
    const preset = await this.getMatchPreset(presetId);
    if (!preset || scheduledAtList.length === 0) return null;
    const created: DbMatch[] = [];
    for (const scheduledAt of scheduledAtList) {
      const match = await this.addMatch(
        gameModeId,
        preset.title,
        preset.entryFee,
        preset.maxParticipants,
        scheduledAt,
        preset.matchType,
        preset.prizePool,
        preset.map,
        preset.image,
      );
      if (!match) return created.length > 0 ? created : null;
      created.push(match);
    }
    return created;
  },

  async getDashboardStats(): Promise<DashboardStats | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: rpcData, error: rpcError } = await supabase.rpc("get_admin_dashboard_stats");
    if (!rpcError && rpcData) {
      return parseDashboardStatsPayload(rpcData);
    }

    const [userRes, moneyRes, matchRes, upcomingRes, pendingRes] = await Promise.all([
      supabase.from("admin_dashboard_user_analytics").select("*").maybeSingle(),
      supabase.from("admin_dashboard_money_analytics").select("*").maybeSingle(),
      supabase.from("admin_dashboard_match_analytics").select("*").maybeSingle(),
      supabase.from("admin_dashboard_upcoming_matches").select("*").limit(3),
      supabase.from("admin_dashboard_pending_withdrawals").select("*").limit(5),
    ]);

    if (userRes.error || moneyRes.error || matchRes.error) {
      return null;
    }

    const users = userRes.data;
    const money = moneyRes.data;
    const matches = matchRes.data;
    const totalDeposits = Number(money?.total_deposits ?? 0);
    const totalWithdrawals = Number(money?.total_withdrawals ?? 0);

    return {
      generatedAt: new Date().toISOString(),
      users: {
        total: users?.total_users ?? 0,
        blocked: users?.blocked_users ?? 0,
        pushEnabled: users?.push_enabled_users ?? 0,
        activePlayers: users?.active_players ?? 0,
        newToday: users?.new_users_today ?? 0,
        new7d: users?.new_users_7d ?? 0,
        new30d: users?.new_users_30d ?? 0,
        walletCoins: Number(users?.wallet_coins ?? 0),
        withdrawableWinnings: Number(users?.withdrawable_winnings ?? 0),
      },
      money: {
        totalDeposits,
        totalWithdrawals,
        netFlow: totalDeposits - totalWithdrawals,
        pendingDepositsCount: money?.pending_deposits_count ?? 0,
        pendingDepositsAmount: Number(money?.pending_deposits_amount ?? 0),
        pendingWithdrawalsCount: money?.pending_withdrawals_count ?? 0,
        pendingWithdrawalsAmount: Number(money?.pending_withdrawals_amount ?? 0),
        depositsToday: Number(money?.deposits_today ?? 0),
        deposits7d: Number(money?.deposits_7d ?? 0),
      },
      matches: {
        upcoming: matches?.upcoming_count ?? 0,
        ongoing: matches?.ongoing_count ?? 0,
        completed: matches?.completed_count ?? 0,
        completed7d: matches?.completed_7d ?? 0,
        solo: matches?.solo_count ?? 0,
        duo: matches?.duo_count ?? 0,
        squad: matches?.squad_count ?? 0,
        avgUpcomingFillRate: Number(matches?.avg_upcoming_fill_rate ?? 0),
        entryFeesCollected: Number(matches?.entry_fees_collected ?? 0),
      },
      upcomingMatches: (upcomingRes.data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        scheduledAt: row.scheduled_at ?? "",
        maxParticipants: row.max_participants ?? 0,
        entryFee: row.entry_fee ?? 0,
        matchType: row.match_type ?? "solo",
        participantCount: row.participant_count ?? 0,
        fillRate: Number(row.fill_rate ?? 0),
      })),
      pendingWithdrawals: (pendingRes.data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        amount: row.amount ?? 0,
        upiId: row.upi_id ?? "",
        createdAt: row.created_at ?? "",
        userDisplayName: row.user_display_name ?? row.user_id,
        userEmail: row.user_email ?? "",
      })),
    };
  },
};

function parseDashboardStatsPayload(raw: unknown): DashboardStats | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const users = data.users as Record<string, unknown> | undefined;
  const money = data.money as Record<string, unknown> | undefined;
  const matches = data.matches as Record<string, unknown> | undefined;
  if (!users || !money || !matches) return null;

  return {
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString(),
    users: {
      total: Number(users.total ?? 0),
      blocked: Number(users.blocked ?? 0),
      pushEnabled: Number(users.pushEnabled ?? 0),
      activePlayers: Number(users.activePlayers ?? 0),
      newToday: Number(users.newToday ?? 0),
      new7d: Number(users.new7d ?? 0),
      new30d: Number(users.new30d ?? 0),
      walletCoins: Number(users.walletCoins ?? 0),
      withdrawableWinnings: Number(users.withdrawableWinnings ?? 0),
    },
    money: {
      totalDeposits: Number(money.totalDeposits ?? 0),
      totalWithdrawals: Number(money.totalWithdrawals ?? 0),
      netFlow: Number(money.netFlow ?? 0),
      pendingDepositsCount: Number(money.pendingDepositsCount ?? 0),
      pendingDepositsAmount: Number(money.pendingDepositsAmount ?? 0),
      pendingWithdrawalsCount: Number(money.pendingWithdrawalsCount ?? 0),
      pendingWithdrawalsAmount: Number(money.pendingWithdrawalsAmount ?? 0),
      depositsToday: Number(money.depositsToday ?? 0),
      deposits7d: Number(money.deposits7d ?? 0),
    },
    matches: {
      upcoming: Number(matches.upcoming ?? 0),
      ongoing: Number(matches.ongoing ?? 0),
      completed: Number(matches.completed ?? 0),
      completed7d: Number(matches.completed7d ?? 0),
      solo: Number(matches.solo ?? 0),
      duo: Number(matches.duo ?? 0),
      squad: Number(matches.squad ?? 0),
      avgUpcomingFillRate: Number(matches.avgUpcomingFillRate ?? 0),
      entryFeesCollected: Number(matches.entryFeesCollected ?? 0),
    },
    upcomingMatches: Array.isArray(data.upcomingMatches)
      ? data.upcomingMatches.map((row) => {
          const m = row as Record<string, unknown>;
          return {
            id: String(m.id ?? ""),
            title: String(m.title ?? ""),
            scheduledAt: String(m.scheduledAt ?? ""),
            maxParticipants: Number(m.maxParticipants ?? 0),
            entryFee: Number(m.entryFee ?? 0),
            matchType: String(m.matchType ?? "solo"),
            participantCount: Number(m.participantCount ?? 0),
            fillRate: Number(m.fillRate ?? 0),
          };
        })
      : [],
    pendingWithdrawals: Array.isArray(data.pendingWithdrawals)
      ? data.pendingWithdrawals.map((row) => {
          const w = row as Record<string, unknown>;
          return {
            id: String(w.id ?? ""),
            userId: String(w.userId ?? ""),
            amount: Number(w.amount ?? 0),
            upiId: String(w.upiId ?? ""),
            createdAt: String(w.createdAt ?? ""),
            userDisplayName: String(w.userDisplayName ?? w.userId ?? ""),
            userEmail: String(w.userEmail ?? ""),
          };
        })
      : [],
  };
}

export function isDbConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
