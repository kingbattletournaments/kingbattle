/**
 * Match slot booking DB operations (hold / confirm / query).
 */

import { getSupabase } from "./supabase";
import { insertCoinTransaction } from "./coin-transaction-db";
import {
  buildSlotGrid,
  slotPositionInTeam,
  slotToTeamNumber,
  teamSizeFor,
  validateMaxParticipants,
  validateSlotSelection,
  type SlotAvailability,
} from "./match-slots";
import {
  computeTeamOrdinals,
  calcRankRewardCoins,
  splitRankRewardAmongPlayers,
  type TeamGroup,
} from "./admin-match-teams";

export type SlotBookingRow = {
  id: string;
  match_id: string;
  slot_index: number;
  app_user_id: string;
  in_game_name: string | null;
  in_game_uid: string | null;
  kills: number;
  squad_rank: number | null;
  status: string;
  hold_id: string | null;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  created_at: string;
};

/** Count joined spots per match (slot bookings or legacy participants). */
export async function getParticipantCountsForMatches(
  matchIds: string[],
): Promise<Record<string, number>> {
  const supabase = getSupabase();
  if (!supabase || matchIds.length === 0) return {};

  const countMap: Record<string, number> = {};
  for (const id of matchIds) countMap[id] = 0;

  const { data: slotActivity } = await supabase
    .from("match_slot_bookings")
    .select("match_id, status")
    .in("match_id", matchIds);

  const slotConfirmedCount: Record<string, number> = {};
  for (const row of slotActivity ?? []) {
    if (row.status === "confirmed") {
      slotConfirmedCount[row.match_id] = (slotConfirmedCount[row.match_id] ?? 0) + 1;
    }
  }

  const { data: legacyRows } = await supabase
    .from("app_match_participants")
    .select("match_id")
    .in("match_id", matchIds);

  const legacyCount: Record<string, number> = {};
  for (const row of legacyRows ?? []) {
    legacyCount[row.match_id] = (legacyCount[row.match_id] ?? 0) + 1;
  }

  for (const id of matchIds) {
    const confirmed = slotConfirmedCount[id] ?? 0;
    const legacy = legacyCount[id] ?? 0;
    // Confirmed slots are authoritative; fall back to legacy when none confirmed yet.
    countMap[id] = confirmed > 0 ? confirmed : legacy;
  }
  return countMap;
}

export async function cleanupExpiredSlotHolds(matchId?: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.rpc("cleanup_expired_slot_holds", { p_match_id: matchId ?? null });
}

export async function getMatchSlotAvailability(
  matchId: string,
  appUserId?: string,
): Promise<
  | {
      matchType: string;
      maxParticipants: number;
      teamSize: number;
      teamCount: number;
      entryFee: number;
      joinedCount: number;
      slots: SlotAvailability[];
    }
  | { error: string }
> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Database not configured" };

  await cleanupExpiredSlotHolds(matchId);

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return { error: "Match not found" };

  const maxParticipants = match.max_participants ?? 100;
  const matchType = match.match_type ?? "solo";
  const teamSize = teamSizeFor(matchType);

  const { data: bookings } = await supabase
    .from("match_slot_bookings")
    .select("slot_index, app_user_id, status")
    .eq("match_id", matchId)
    .in("status", ["held", "confirmed"]);

  const slots = buildSlotGrid(
    maxParticipants,
    matchType,
    (bookings ?? []) as { slot_index: number; app_user_id: string; status: string }[],
    appUserId,
  );

  const joinedCount = (bookings ?? []).filter((b) => b.status === "confirmed").length;

  return {
    matchType,
    maxParticipants,
    teamSize,
    teamCount: Math.floor(maxParticipants / teamSize),
    entryFee: match.entry_fee ?? 0,
    joinedCount,
    slots,
  };
}

export async function holdMatchSlots(
  matchId: string,
  appUserId: string,
  slotIndices: number[],
): Promise<{ holdId: string } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Database not configured" };

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return { error: "Match not found" };
  if (match.status !== "upcoming") return { error: "Registration closed" };
  if (match.registration_locked) return { error: "Registration locked" };

  const maxParticipants = match.max_participants ?? 100;
  const matchType = match.match_type ?? "solo";
  const validation = validateSlotSelection(slotIndices, matchType, maxParticipants);
  if (validation) return { error: validation };

  const { data: user } = await supabase
    .from("app_users")
    .select("is_blocked")
    .eq("username", appUserId)
    .single();
  if (!user) return { error: "User not found" };
  if (user.is_blocked) return { error: "Account is blocked" };

  const { data: holdId, error } = await supabase.rpc("hold_match_slots", {
    p_match_id: matchId,
    p_app_user_id: appUserId,
    p_slot_indices: slotIndices,
    p_hold_seconds: 300,
  });

  if (error) {
    const msg = error.message.includes("unavailable")
      ? "One or more slots were just taken. Please refresh and try again."
      : error.message;
    return { error: msg };
  }

  return { holdId: holdId as string };
}

export async function confirmSlotBookings(
  matchId: string,
  appUserId: string,
  holdId: string,
  slots: { slotIndex: number; inGameName: string; inGameUid: string }[],
): Promise<{ error?: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Database not configured" };

  await cleanupExpiredSlotHolds(matchId);

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).single();
  if (!match) return { error: "Match not found" };
  if (match.status !== "upcoming") return { error: "Registration closed" };
  if (match.registration_locked) return { error: "Registration locked" };

  const maxParticipants = match.max_participants ?? 100;
  const matchType = match.match_type ?? "solo";
  const slotIndices = slots.map((s) => s.slotIndex);
  const validation = validateSlotSelection(slotIndices, matchType, maxParticipants);
  if (validation) return { error: validation };

  if (slots.some((s) => !s.inGameName?.trim() || !s.inGameUid?.trim())) {
    return { error: "In-game name and UID required for each slot" };
  }

  const { data: heldRows, error: heldErr } = await supabase
    .from("match_slot_bookings")
    .select("*")
    .eq("match_id", matchId)
    .eq("app_user_id", appUserId)
    .eq("hold_id", holdId)
    .eq("status", "held");

  if (heldErr || !heldRows?.length) {
    return { error: "Hold expired or invalid. Please select slots again." };
  }

  const heldIndices = new Set(heldRows.map((r: SlotBookingRow) => r.slot_index));
  for (const s of slots) {
    if (!heldIndices.has(s.slotIndex)) {
      return { error: "Selected slots do not match your hold. Please try again." };
    }
  }
  if (slots.length !== heldRows.length) {
    return { error: "Provide details for every held slot" };
  }

  const entryFee = match.entry_fee ?? 0;
  const totalFee = entryFee * slots.length;

  const { data: user } = await supabase
    .from("app_users")
    .select("coins, won_coins, is_blocked")
    .eq("username", appUserId)
    .single();
  if (!user) return { error: "User not found" };
  if (user.is_blocked) return { error: "Account is blocked" };
  const totalBalance = (user.coins ?? 0) + (user.won_coins ?? 0);
  if (totalBalance < totalFee) return { error: "Insufficient coins" };

  const now = new Date().toISOString();
  for (const s of slots) {
    const { error: updErr } = await supabase
      .from("match_slot_bookings")
      .update({
        status: "confirmed",
        in_game_name: s.inGameName.trim(),
        in_game_uid: s.inGameUid.trim(),
        hold_expires_at: null,
        confirmed_at: now,
      })
      .eq("match_id", matchId)
      .eq("slot_index", s.slotIndex)
      .eq("app_user_id", appUserId)
      .eq("hold_id", holdId)
      .eq("status", "held");

    if (updErr) return { error: updErr.message };
  }

  if (totalFee > 0) {
    let deductCoins = 0;
    let deductWonCoins = 0;
    if ((user.coins ?? 0) >= totalFee) {
      deductCoins = totalFee;
    } else {
      deductCoins = user.coins ?? 0;
      deductWonCoins = totalFee - deductCoins;
    }
    await supabase
      .from("app_users")
      .update({
        coins: (user.coins ?? 0) - deductCoins,
        won_coins: (user.won_coins ?? 0) - deductWonCoins,
      })
      .eq("username", appUserId);
    await insertCoinTransaction(supabase, {
      user_id: appUserId,
      amount: -totalFee,
      type: "match_entry",
      reference_id: matchId,
      description: `Match entry (${slots.length} slot${slots.length === 1 ? "" : "s"})`,
    });
  }

  return null;
}

export async function fetchConfirmedSlotParticipants(
  matchId: string,
): Promise<
  {
    id: string;
    matchId: string;
    userId: string;
    slotIndex: number;
    teamMembers: { inGameName: string; inGameUid: string; kills?: number }[];
    joinedAt: string;
    rank?: number;
  }[]
> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data: slots } = await supabase
    .from("match_slot_bookings")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "confirmed")
    .order("slot_index", { ascending: true });

  if (!slots?.length) return [];

  return (slots as SlotBookingRow[]).map((s) => ({
    id: s.id,
    matchId: s.match_id,
    userId: s.app_user_id,
    slotIndex: s.slot_index,
    teamMembers: [
      {
        inGameName: s.in_game_name ?? "",
        inGameUid: s.in_game_uid ?? "",
        kills: s.kills ?? 0,
      },
    ],
    joinedAt: s.confirmed_at ?? s.created_at,
    rank: s.squad_rank ?? undefined,
  }));
}

export async function refundSlotBookingsForMatch(
  matchId: string,
  entryFee: number,
  title: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || entryFee <= 0) return;

  const { data: slotRows } = await supabase
    .from("match_slot_bookings")
    .select("app_user_id")
    .eq("match_id", matchId)
    .eq("status", "confirmed");

  const refundByUser = new Map<string, number>();
  for (const row of slotRows ?? []) {
    const uid = (row as { app_user_id: string }).app_user_id;
    refundByUser.set(uid, (refundByUser.get(uid) ?? 0) + entryFee);
  }

  for (const [appUserId, amount] of Array.from(refundByUser.entries())) {
    const { data: user } = await supabase.from("app_users").select("coins").eq("username", appUserId).single();
    if (!user || typeof user.coins !== "number") continue;
    await supabase.from("app_users").update({ coins: user.coins + amount }).eq("username", appUserId);
    await insertCoinTransaction(supabase, {
      user_id: appUserId,
      amount,
      type: "refund",
      reference_id: matchId,
      description: `Refund: ${title} cancelled (${amount / entryFee} slot${amount / entryFee === 1 ? "" : "s"})`,
    });
  }
}

export async function finishMatchSlotPayouts(
  matchId: string,
  matchType: string,
  cpk: number,
  rankRewards: { fromRank: number; toRank: number; coins: number }[],
  addMatchWinnings: (userId: string, coins: number, matchId: string) => Promise<void>,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data: slots } = await supabase
    .from("match_slot_bookings")
    .select("*")
    .eq("match_id", matchId)
    .eq("status", "confirmed");

  if (!slots?.length) return false;

  const rows = slots as SlotBookingRow[];

  const killCoinsByUser = new Map<string, number>();
  for (const s of rows) {
    const coins = (s.kills ?? 0) * cpk;
    if (coins > 0) {
      killCoinsByUser.set(s.app_user_id, (killCoinsByUser.get(s.app_user_id) ?? 0) + coins);
    }
  }

  const teams = new Map<number, SlotBookingRow[]>();
  for (const s of rows) {
    const teamNum = slotToTeamNumber(s.slot_index, matchType);
    if (!teams.has(teamNum)) teams.set(teamNum, []);
    teams.get(teamNum)!.push(s);
  }

  const teamGroups: TeamGroup[] = Array.from(teams.entries()).map(([teamNumber, teamSlots]) => ({
    teamNumber,
    slots: teamSlots.map((s) => ({
      slotPositionInTeam: slotPositionInTeam(s.slot_index, matchType),
      globalSlotIndex: s.slot_index,
      participant: {
        id: s.id,
        userId: s.app_user_id,
        slotIndex: s.slot_index,
        teamMembers: [
          {
            inGameName: s.in_game_name ?? "",
            inGameUid: s.in_game_uid ?? "",
            kills: s.kills ?? 0,
          },
        ],
        rank: s.squad_rank ?? undefined,
      },
    })),
    players: teamSlots.map((s) => ({
      id: s.id,
      userId: s.app_user_id,
      slotIndex: s.slot_index,
      teamMembers: [
        {
          inGameName: s.in_game_name ?? "",
          inGameUid: s.in_game_uid ?? "",
          kills: s.kills ?? 0,
        },
      ],
      rank: s.squad_rank ?? undefined,
    })),
  }));

  const teamOrdinals = computeTeamOrdinals(teamGroups);

  const rankCoinsByUser = new Map<string, number>();
  for (const [teamNum, teamSlots] of Array.from(teams.entries())) {
    const teamOrdinal = teamOrdinals.get(teamNum);
    if (!teamOrdinal) continue;

    const rankReward = calcRankRewardCoins(teamOrdinal, { coinsPerKill: cpk, rankRewards });
    if (rankReward <= 0) continue;

    const players = teamSlots.map((s) => ({
      id: s.id,
      kills: s.kills ?? 0,
      userId: s.app_user_id,
    }));

    const shares = splitRankRewardAmongPlayers(rankReward, players);
    for (const [pid, coins] of Array.from(shares.entries())) {
      const row = teamSlots.find((s) => s.id === pid);
      if (!row) continue;
      rankCoinsByUser.set(row.app_user_id, (rankCoinsByUser.get(row.app_user_id) ?? 0) + coins);
    }
  }

  const totalByUser = new Map<string, number>();
  for (const [uid, c] of Array.from(killCoinsByUser.entries())) totalByUser.set(uid, (totalByUser.get(uid) ?? 0) + c);
  for (const [uid, c] of Array.from(rankCoinsByUser.entries())) totalByUser.set(uid, (totalByUser.get(uid) ?? 0) + c);

  for (const [userId, coins] of Array.from(totalByUser.entries())) {
    if (coins > 0) await addMatchWinnings(userId, coins, matchId);
  }

  const statsByUser = new Map<string, { kills: number }>();
  for (const s of rows) {
    const prev = statsByUser.get(s.app_user_id) ?? { kills: 0 };
    prev.kills += s.kills ?? 0;
    statsByUser.set(s.app_user_id, prev);
  }
  for (const [userId, stat] of Array.from(statsByUser.entries())) {
    const { data: userRow } = await supabase
      .from("app_users")
      .select("matches_played, total_kills")
      .eq("username", userId)
      .single();
    if (userRow) {
      await supabase
        .from("app_users")
        .update({
          matches_played: (userRow.matches_played ?? 0) + 1,
          total_kills: (userRow.total_kills ?? 0) + stat.kills,
        })
        .eq("username", userId);
    }
  }

  return true;
}

export { validateMaxParticipants };
