/**
 * Supabase database layer for app_users, deposits, withdrawals, transactions, admins, settings.
 * Use when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
 */

import bcrypt from "bcryptjs";
import { getSupabase } from "./supabase";
import type { AppBanner } from "./admin-store";


// Types matching admin-store
export type DbUser = {
  id: string;
  email: string;
  displayName: string;
  coins: number;
  wonCoins: number;
  isBlocked?: boolean;
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
  createdAt: string;
};

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
};

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
  };
}

function toUser(row: {
  username?: string;
  email: string;
  display_name: string;
  coins: number;
  won_coins?: number;
  is_blocked?: boolean;
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
      await supabase.from("app_coin_transactions").insert({
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
          await supabase.from("app_coin_transactions").insert({
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
        await supabase.from("app_coin_transactions").insert({
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
    const { data } = await supabase.from("app_users").select("*").ilike("email", email).single();
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
    await supabase.from("app_coin_transactions").insert({
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
    await supabase.from("app_coin_transactions").insert({
      user_id: userId,
      amount,
      type: "match_winning",
      reference_id: matchId,
      description: `Winning with match ${matchId}`,
    });
    return true;
  },

  async blockUser(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("app_users").update({ is_blocked: true }).eq("username", userId);
    return !error;
  },

  async unblockUser(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("app_users").update({ is_blocked: false }).eq("username", userId);
    return !error;
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
    if (error) return null;
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
      await supabase.from("app_coin_transactions").insert({
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
    await supabase.from("app_coin_transactions").insert({
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
    await supabase.from("app_coin_transactions").insert({
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
    await supabase.from("app_coin_transactions").insert({
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
    await supabase.from("app_coin_transactions").insert({
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
    if (error || !data) return null;
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
    if (error || !data) return null;
    return { id: data.id, gameId: data.game_id, name: data.name, imageUrl: data.image_url ?? null };
  },

  async deleteGameMode(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("game_modes").delete().eq("id", id);
    return !error;
  },

  async renameGameMode(id: string, name: string): Promise<{ id: string; gameId: string; name: string; imageUrl: string | null } | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("game_modes").update({ name, updated_at: new Date().toISOString() }).eq("id", id).select("id, game_id, name, image_url").single();
    if (error || !data) return null;
    return { id: data.id, gameId: data.game_id, name: data.name, imageUrl: data.image_url ?? null };
  },

  async matches(modeId?: string): Promise<DbMatch[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let q = supabase.from("matches").select("*").order("starts_at", { ascending: true, nullsFirst: false });
    if (modeId) q = q.eq("game_mode_id", modeId);
    const { data } = await q;
    return (data ?? []).map(toMatch);
  },

  async addMatch(
    gameModeId: string,
    title: string,
    entryFee: number,
    maxParticipants: number,
    scheduledAt: string,
    matchType: string,
    prizePool: { coinsPerKill: number; totalPrizePool?: number; rankRewards: { fromRank: number; toRank: number; coins: number }[] },
    map?: string
  ): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("matches")
      .insert({
        game_mode_id: gameModeId,
        title,
        entry_fee: entryFee,
        max_participants: maxParticipants,
        starts_at: scheduledAt || null,
        match_type: matchType || "solo",
        coins_per_kill: prizePool?.coinsPerKill ?? 5,
        total_prize_pool: prizePool?.totalPrizePool ?? 0,
        rank_rewards: prizePool?.rankRewards ?? [],
        map: map || "BERMUDA",
      })
      .select()
      .single();
    if (error || !data) return null;
    return toMatch(data);
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
    const participants = [
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
    return { ...toMatch(matchRow), participants };
  },

  async joinMatch(
    matchId: string,
    appUserId: string,
    inGameName: string,
    inGameUid: string,
    teamMembers?: { inGameName: string; inGameUid: string }[]
  ): Promise<{ error?: string } | null> {
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
      await supabase.from("app_coin_transactions").insert({
        user_id: appUserId,
        amount: -entryFee,
        type: "match_entry",
        reference_id: matchId,
        description: "Match entry fee",
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

    const { data, error } = await supabase
      .from("matches")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "upcoming")
      .select()
      .single();
    if (error || !data) return null;

    if (entryFee > 0) {
      const { data: appRows } = await supabase.from("app_match_participants").select("app_user_id").eq("match_id", id);
      const appUserIds = Array.from(new Set((appRows ?? []).map((r: { app_user_id: string }) => r.app_user_id)));
      for (const appUserId of appUserIds) {
        const { data: user } = await supabase.from("app_users").select("coins").eq("username", appUserId).single();
        if (!user || typeof user.coins !== "number") continue;
        await supabase.from("app_users").update({ coins: user.coins + entryFee }).eq("username", appUserId);
        await supabase.from("app_coin_transactions").insert({
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

    return toMatch(data);
  },

  async deleteMatch(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase.from("matches").delete().eq("id", id);
    return !error;
  },

  async renameMatch(id: string, title: string): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("matches").update({ title, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error || !data) return null;
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

  async finishMatch(id: string): Promise<DbMatch | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const match = await db.getMatch(id);
    if (!match || match.status !== "ongoing") return null;
    const participants = match.participants ?? [];
    const prizePool = match.prizePool ?? { coinsPerKill: 0, totalPrizePool: 0, rankRewards: [] };
    const rewards = prizePool.rankRewards ?? [];
    const cpk = prizePool.coinsPerKill ?? 0;
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

    // Update matches_played and total_kills stats for all participants
    for (const p of participants) {
      if (p.userId) {
        const totalKills = (p.teamMembers ?? []).reduce((s, t) => s + (t.kills ?? 0), 0);
        const isAppUser = p.userId.length !== 36; // UUID is 36 chars
        if (isAppUser) {
          const { data: userRow } = await supabase.from("app_users").select("matches_played, total_kills").eq("username", p.userId).single();
          if (userRow) {
            await supabase.from("app_users").update({
              matches_played: (userRow.matches_played ?? 0) + 1,
              total_kills: (userRow.total_kills ?? 0) + totalKills
            }).eq("username", p.userId);
          }
        } else {
          const { data: userRow } = await supabase.from("users").select("matches_played, total_kills").eq("id", p.userId).single();
          if (userRow) {
            await supabase.from("users").update({
              matches_played: (userRow.matches_played ?? 0) + 1,
              total_kills: (userRow.total_kills ?? 0) + totalKills
            }).eq("id", p.userId);
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
    const { data: games } = await supabase.from("admin_allowed_games").select("game_id").eq("admin_id", admin.id);
    const allowedGameIds = (games ?? []).map((g) => g.game_id);
    return {
      id: admin.id,
      adminname: admin.adminname,
      passwordHash: admin.password_hash,
      isMasterAdmin: admin.is_master_admin ?? false,
      usersAccess: admin.users_access ?? false,
      coinsAccess: admin.coins_access ?? false,
      gamesAccessType: (admin.games_access_type as "all" | "specific") ?? "all",
      allowedGameIds,
      createdAt: admin.created_at,
    };
  },

  async getAdminById(id: string): Promise<DbAdmin | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: admin } = await supabase.from("admins").select("*").eq("id", id).single();
    if (!admin) return null;
    const { data: games } = await supabase.from("admin_allowed_games").select("game_id").eq("admin_id", admin.id);
    return {
      id: admin.id,
      adminname: admin.adminname,
      passwordHash: "[hidden]",
      isMasterAdmin: admin.is_master_admin ?? false,
      usersAccess: admin.users_access ?? false,
      coinsAccess: admin.coins_access ?? false,
      gamesAccessType: (admin.games_access_type as "all" | "specific") ?? "all",
      allowedGameIds: (games ?? []).map((g) => g.game_id),
      createdAt: admin.created_at,
    };
  },

  async getAllAdmins(): Promise<DbAdmin[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data: admins } = await supabase.from("admins").select("*").not("adminname", "is", null);
    if (!admins) return [];
    const result: DbAdmin[] = [];
    for (const a of admins) {
      const { data: games } = await supabase.from("admin_allowed_games").select("game_id").eq("admin_id", a.id);
      result.push({
        id: a.id,
        adminname: a.adminname ?? "",
        passwordHash: "[hidden]",
        isMasterAdmin: a.is_master_admin ?? false,
        usersAccess: a.users_access ?? false,
        coinsAccess: a.coins_access ?? false,
        gamesAccessType: (a.games_access_type as "all" | "specific") ?? "all",
        allowedGameIds: (games ?? []).map((g) => g.game_id),
        createdAt: a.created_at,
      });
    }
    return result;
  },

  async createAdmin(
    adminname: string,
    password: string,
    opts: { usersAccess: boolean; coinsAccess: boolean; gamesAccessType: "all" | "specific"; allowedGameIds: string[] }
  ): Promise<DbAdmin | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: existing } = await supabase.from("admins").select("id").ilike("adminname", adminname).single();
    if (existing) return null;
    const hash = bcrypt.hashSync(password, 10);
    const { data: admin, error } = await supabase
      .from("admins")
      .insert({
        adminname,
        password_hash: hash,
        is_master_admin: false,
        users_access: opts.usersAccess,
        coins_access: opts.coinsAccess,
        games_access_type: opts.gamesAccessType,
      })
      .select()
      .single();
    if (error || !admin) return null;
    if (opts.gamesAccessType === "specific" && opts.allowedGameIds?.length) {
      await supabase.from("admin_allowed_games").insert(opts.allowedGameIds.map((gid) => ({ admin_id: admin.id, game_id: gid })));
    }
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
    const { error } = await supabase
      .from("app_users")
      .update({ fcm_token: token })
      .eq("username", userId);
    return !error;
  }
};

export function isDbConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
