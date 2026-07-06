import { getSupabase } from "./supabase";
import { fetchConfirmedSlotParticipants } from "./db-match-slots";
import { type DbCoinTransaction, type DbMatch } from "./db";
import {
  addDaysDateOnly,
  isoToIstDateOnly,
  istDayEndExclusiveIso,
  istDayStartIso,
  yesterdayIstDateOnly,
} from "./storage-dates";

const PURGE_CURSOR_KEY = "storage_purge_cursor";
const SYSTEM_START_KEY = "storage_system_start_date";

export type StorageBounds = {
  minStartDate: string;
  maxEndDate: string;
  purgeCursor: string | null;
};

export type StoragePreview = {
  transactionCount: number;
  matchCount: number;
};

export type ArchiveParticipant = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string | null;
  inGameName: string;
  inGameUid: string;
  kills: number;
  rank: number | null;
  slotIndex: number | null;
  winningsCoins: number;
  entryFeePaid: number;
  teamMembers: { inGameName: string; inGameUid: string; kills: number }[];
};

export type ArchiveMatch = {
  match: DbMatch;
  gameModeName: string;
  gameName: string | null;
  participants: ArchiveParticipant[];
};

export type ArchiveTransaction = DbCoinTransaction & {
  userDisplayName: string | null;
  userEmail: string | null;
};

export type StorageArchivePayload = {
  startDate: string;
  endDate: string;
  exportedAt: string;
  transactions: ArchiveTransaction[];
  matches: ArchiveMatch[];
};

function rowToMatch(row: Record<string, unknown>): DbMatch {
  const rewards = Array.isArray(row.rank_rewards)
    ? (row.rank_rewards as { fromRank?: number; toRank?: number; coins?: number }[])
        .filter((r) => r && typeof r.fromRank === "number" && typeof r.toRank === "number" && typeof r.coins === "number")
        .map((r) => ({ fromRank: r.fromRank!, toRank: r.toRank!, coins: r.coins! }))
    : [];
  return {
    id: String(row.id),
    gameModeId: String(row.game_mode_id),
    title: String(row.title ?? ""),
    entryFee: Number(row.entry_fee ?? 0),
    roomCode: (row.room_code as string | null) ?? null,
    roomPassword: (row.room_password as string | null) ?? null,
    status: String(row.status ?? "upcoming"),
    maxParticipants: Number(row.max_participants ?? 100),
    scheduledAt: String(row.starts_at ?? ""),
    registrationLocked: Boolean(row.registration_locked),
    matchType: String(row.match_type ?? "solo"),
    prizePool: {
      coinsPerKill: Number(row.coins_per_kill ?? 5),
      totalPrizePool: Number(row.total_prize_pool ?? 0),
      rankRewards: rewards,
    },
    map: String(row.map ?? "BERMUDA"),
    image: (row.image as string | null) ?? null,
    matchNumber: row.match_number != null ? Number(row.match_number) : undefined,
  };
}

async function readSetting(key: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = data?.value?.trim();
  return v || null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("app_settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

async function earliestRecordDate(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [txRes, matchRes] = await Promise.all([
    supabase.from("app_coin_transactions").select("created_at").order("created_at", { ascending: true }).limit(1),
    supabase.from("matches").select("starts_at").not("starts_at", "is", null).order("starts_at", { ascending: true }).limit(1),
  ]);

  const dates: string[] = [];
  const txDate = txRes.data?.[0]?.created_at;
  const matchDate = matchRes.data?.[0]?.starts_at;
  if (txDate) dates.push(isoToIstDateOnly(String(txDate)));
  if (matchDate) dates.push(isoToIstDateOnly(String(matchDate)));
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

export async function getStorageBounds(): Promise<StorageBounds> {
  const purgeCursor = await readSetting(PURGE_CURSOR_KEY);
  const systemStart = await readSetting(SYSTEM_START_KEY);
  const earliest = await earliestRecordDate();
  const maxEndDate = yesterdayIstDateOnly();

  let minStartDate = purgeCursor ?? systemStart ?? earliest ?? maxEndDate;
  if (minStartDate > maxEndDate) minStartDate = maxEndDate;

  return { minStartDate, maxEndDate, purgeCursor };
}

export function validateStorageRange(
  startDate: string,
  endDate: string,
  bounds: StorageBounds,
): string | null {
  if (startDate > endDate) return "Start date must be on or before end date.";
  if (startDate < bounds.minStartDate) {
    return `Start date cannot be before ${bounds.minStartDate}. Data before this date has already been archived and removed.`;
  }
  if (endDate > bounds.maxEndDate) {
    return `End date cannot be after ${bounds.maxEndDate} (yesterday). Today's data must remain in the database.`;
  }
  return null;
}

export async function previewStorageRange(startDate: string, endDate: string): Promise<StoragePreview> {
  const supabase = getSupabase();
  if (!supabase) return { transactionCount: 0, matchCount: 0 };

  const txStart = istDayStartIso(startDate);
  const txEnd = istDayEndExclusiveIso(endDate);
  const matchStart = txStart;
  const matchEnd = txEnd;

  const [txRes, matchRes] = await Promise.all([
    supabase
      .from("app_coin_transactions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", txStart)
      .lt("created_at", txEnd),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", matchStart)
      .lt("starts_at", matchEnd),
  ]);

  return {
    transactionCount: txRes.count ?? 0,
    matchCount: matchRes.count ?? 0,
  };
}

async function loadUserMap(userIds: string[]): Promise<Map<string, { displayName: string; email: string }>> {
  const supabase = getSupabase();
  const map = new Map<string, { displayName: string; email: string }>();
  if (!supabase || userIds.length === 0) return map;

  const unique = Array.from(new Set(userIds));
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data } = await supabase
      .from("app_users")
      .select("username, display_name, email")
      .in("username", chunk);
    for (const u of data ?? []) {
      map.set(u.username, { displayName: u.display_name ?? u.username, email: u.email ?? "" });
    }
  }
  return map;
}

async function loadModeNames(modeIds: string[]): Promise<Map<string, { modeName: string; gameName: string | null }>> {
  const supabase = getSupabase();
  const map = new Map<string, { modeName: string; gameName: string | null }>();
  if (!supabase || modeIds.length === 0) return map;

  const unique = Array.from(new Set(modeIds));
  const { data: modes } = await supabase.from("game_modes").select("id, name, game_id").in("id", unique);
  const gameIds = Array.from(new Set((modes ?? []).map((m) => m.game_id).filter(Boolean)));
  const { data: games } = gameIds.length
    ? await supabase.from("games").select("id, name").in("id", gameIds)
    : { data: [] as { id: string; name: string }[] };
  const gameById = new Map((games ?? []).map((g) => [g.id, g.name]));

  for (const m of modes ?? []) {
    map.set(m.id, { modeName: m.name, gameName: gameById.get(m.game_id) ?? null });
  }
  return map;
}

function mapLegacyParticipant(p: {
  id: string;
  match_id: string;
  user_id?: string;
  app_user_id?: string;
  in_game_name: string;
  in_game_uid: string;
  kills?: number | null;
  squad_rank?: number | null;
  joined_at: string;
  participant_2_name?: string | null;
  participant_2_uid?: string | null;
  participant_3_name?: string | null;
  participant_3_uid?: string | null;
  participant_4_name?: string | null;
  participant_4_uid?: string | null;
}): Omit<ArchiveParticipant, "displayName" | "email" | "winningsCoins" | "entryFeePaid"> {
  const members: { inGameName: string; inGameUid: string; kills: number }[] = [
    { inGameName: p.in_game_name, inGameUid: p.in_game_uid, kills: p.kills ?? 0 },
  ];
  const extras: [string | null | undefined, string | null | undefined][] = [
    [p.participant_2_name, p.participant_2_uid],
    [p.participant_3_name, p.participant_3_uid],
    [p.participant_4_name, p.participant_4_uid],
  ];
  for (const [n, u] of extras) {
    const nn = (n ?? "").trim();
    const uu = (u ?? "").trim();
    if (nn && uu) members.push({ inGameName: nn, inGameUid: uu, kills: 0 });
  }
  return {
    id: p.id,
    userId: p.app_user_id ?? p.user_id ?? "",
    inGameName: p.in_game_name,
    inGameUid: p.in_game_uid,
    kills: p.kills ?? 0,
    rank: p.squad_rank ?? null,
    slotIndex: null,
    teamMembers: members,
  };
}

export async function fetchStorageArchive(startDate: string, endDate: string): Promise<StorageArchivePayload> {
  const supabase = getSupabase();
  if (!supabase) {
    return { startDate, endDate, exportedAt: new Date().toISOString(), transactions: [], matches: [] };
  }

  const txStart = istDayStartIso(startDate);
  const txEnd = istDayEndExclusiveIso(endDate);

  const allTxRows: ArchiveTransaction[] = [];
  let txFrom = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("app_coin_transactions")
      .select("*")
      .gte("created_at", txStart)
      .lt("created_at", txEnd)
      .order("created_at", { ascending: true })
      .range(txFrom, txFrom + pageSize - 1);
    if (error) break;
    const rows = data ?? [];
    for (const row of rows) {
      allTxRows.push({
        id: row.id,
        userId: row.user_id,
        amount: row.amount,
        type: row.type,
        referenceId: row.reference_id ?? undefined,
        referenceText: row.reference_text ?? undefined,
        description: row.description ?? undefined,
        createdAt: row.created_at,
        userDisplayName: null,
        userEmail: null,
      });
    }
    if (rows.length < pageSize) break;
    txFrom += pageSize;
  }

  const txUserIds = allTxRows.map((t) => t.userId);
  const userMap = await loadUserMap(txUserIds);
  for (const t of allTxRows) {
    const u = userMap.get(t.userId);
    t.userDisplayName = u?.displayName ?? null;
    t.userEmail = u?.email ?? null;
  }

  const matchRows: DbMatch[] = [];
  let matchFrom = 0;
  while (true) {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .gte("starts_at", txStart)
      .lt("starts_at", txEnd)
      .order("starts_at", { ascending: true })
      .range(matchFrom, matchFrom + pageSize - 1);
    if (error) break;
    const rows = data ?? [];
    matchRows.push(...rows.map((r) => rowToMatch(r as Record<string, unknown>)));
    if (rows.length < pageSize) break;
    matchFrom += pageSize;
  }

  const modeMap = await loadModeNames(matchRows.map((m) => m.gameModeId));
  const matchIds = matchRows.map((m) => m.id);

  const winningsByMatchUser = new Map<string, number>();
  const entryByMatchUser = new Map<string, number>();
  if (matchIds.length > 0) {
    for (let i = 0; i < matchIds.length; i += 100) {
      const chunk = matchIds.slice(i, i + 100);
      const { data: relatedTx } = await supabase
        .from("app_coin_transactions")
        .select("user_id, amount, type, reference_id")
        .in("reference_id", chunk)
        .in("type", ["match_winning", "match_entry"]);
      for (const tx of relatedTx ?? []) {
        const key = `${tx.reference_id}:${tx.user_id}`;
        if (tx.type === "match_winning") {
          winningsByMatchUser.set(key, (winningsByMatchUser.get(key) ?? 0) + Math.max(0, tx.amount));
        } else if (tx.type === "match_entry") {
          entryByMatchUser.set(key, (entryByMatchUser.get(key) ?? 0) + Math.abs(tx.amount));
        }
      }
    }
  }

  const archiveMatches: ArchiveMatch[] = [];
  for (const match of matchRows) {
    const slotParts = await fetchConfirmedSlotParticipants(match.id);
    let participants: ArchiveParticipant[] = [];

    if (slotParts.length > 0) {
      participants = slotParts.map((p) => {
        const key = `${match.id}:${p.userId}`;
        return {
          id: p.id,
          userId: p.userId,
          displayName: userMap.get(p.userId)?.displayName ?? null,
          email: userMap.get(p.userId)?.email ?? null,
          inGameName: p.teamMembers[0]?.inGameName ?? "",
          inGameUid: p.teamMembers[0]?.inGameUid ?? "",
          kills: p.teamMembers.reduce((s, m) => s + (m.kills ?? 0), 0),
          rank: p.rank ?? null,
          slotIndex: p.slotIndex,
          winningsCoins: winningsByMatchUser.get(key) ?? 0,
          entryFeePaid: entryByMatchUser.get(key) ?? match.entryFee,
          teamMembers: p.teamMembers.map((m) => ({
            inGameName: m.inGameName,
            inGameUid: m.inGameUid,
            kills: m.kills ?? 0,
          })),
        };
      });
    } else {
      const [{ data: appParts }, { data: legacyParts }] = await Promise.all([
        supabase
          .from("app_match_participants")
          .select(
            "id, match_id, app_user_id, in_game_name, in_game_uid, kills, squad_rank, joined_at, participant_2_name, participant_2_uid, participant_3_name, participant_3_uid, participant_4_name, participant_4_uid",
          )
          .eq("match_id", match.id),
        supabase
          .from("match_participants")
          .select("id, match_id, user_id, in_game_name, in_game_uid, kills, squad_rank, joined_at")
          .eq("match_id", match.id),
      ]);

      const raw = [
        ...(appParts ?? []).map((p) => mapLegacyParticipant(p)),
        ...(legacyParts ?? []).map((p) => mapLegacyParticipant({ ...p, app_user_id: p.user_id })),
      ];

      const partUserIds = raw.map((p) => p.userId).filter(Boolean);
      const partUsers = await loadUserMap(partUserIds);
      participants = raw.map((p) => {
        const key = `${match.id}:${p.userId}`;
        const u = partUsers.get(p.userId);
        return {
          ...p,
          displayName: u?.displayName ?? null,
          email: u?.email ?? null,
          winningsCoins: winningsByMatchUser.get(key) ?? 0,
          entryFeePaid: entryByMatchUser.get(key) ?? match.entryFee,
        };
      });
    }

    const modeInfo = modeMap.get(match.gameModeId);
    archiveMatches.push({
      match,
      gameModeName: modeInfo?.modeName ?? match.gameModeId,
      gameName: modeInfo?.gameName ?? null,
      participants,
    });
  }

  return {
    startDate,
    endDate,
    exportedAt: new Date().toISOString(),
    transactions: allTxRows,
    matches: archiveMatches,
  };
}

export async function purgeStorageArchive(startDate: string, endDate: string): Promise<{
  deletedTransactions: number;
  deletedMatches: number;
}> {
  const supabase = getSupabase();
  if (!supabase) return { deletedTransactions: 0, deletedMatches: 0 };

  const txStart = istDayStartIso(startDate);
  const txEnd = istDayEndExclusiveIso(endDate);

  const matchIds: string[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from("matches")
      .select("id")
      .gte("starts_at", txStart)
      .lt("starts_at", txEnd)
      .range(from, from + 999);
    const rows = data ?? [];
    matchIds.push(...rows.map((r) => r.id));
    if (rows.length < 1000) break;
    from += 1000;
  }

  if (matchIds.length > 0) {
    for (let i = 0; i < matchIds.length; i += 100) {
      const chunk = matchIds.slice(i, i + 100);
      await supabase.from("match_slot_bookings").delete().in("match_id", chunk);
      await supabase.from("app_match_participants").delete().in("match_id", chunk);
      await supabase.from("match_participants").delete().in("match_id", chunk);
      await supabase.from("app_coin_transactions").delete().in("reference_id", chunk);
      await supabase.from("matches").delete().in("id", chunk);
    }
  }

  const { count: txCountBefore } = await supabase
    .from("app_coin_transactions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", txStart)
    .lt("created_at", txEnd);

  await supabase.from("app_coin_transactions").delete().gte("created_at", txStart).lt("created_at", txEnd);

  const nextCursor = addDaysDateOnly(endDate, 1);
  await writeSetting(PURGE_CURSOR_KEY, nextCursor);

  return {
    deletedTransactions: txCountBefore ?? 0,
    deletedMatches: matchIds.length,
  };
}

export async function setStorageSystemStartDate(date: string): Promise<void> {
  await writeSetting(SYSTEM_START_KEY, date);
}
