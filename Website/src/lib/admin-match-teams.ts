import { slotToTeamNumber, teamSizeFor, teamSlotIndices } from "@/lib/match-slots";

export type AdminSlotParticipant = {
  id: string;
  userId: string;
  slotIndex?: number;
  teamMembers: { inGameName: string; inGameUid: string; kills?: number }[];
  rank?: number;
};

export type RankReward = { fromRank: number; toRank: number; coins: number };
export type PrizePool = {
  coinsPerKill: number;
  totalPrizePool?: number;
  rankRewards: RankReward[];
};

export type TeamGroup = {
  teamNumber: number;
  players: (AdminSlotParticipant & { slotIndex: number })[];
};

export function buildSlotMap(
  maxParticipants: number,
  participants: AdminSlotParticipant[],
): Map<number, AdminSlotParticipant | null> {
  const map = new Map<number, AdminSlotParticipant | null>();
  for (let i = 1; i <= maxParticipants; i++) map.set(i, null);

  const withSlot = participants.filter((p) => typeof p.slotIndex === "number");
  if (withSlot.length > 0) {
    for (const p of withSlot) map.set(p.slotIndex!, p);
    return map;
  }

  let idx = 1;
  for (const p of participants) {
    if (idx > maxParticipants) break;
    map.set(idx, { ...p, slotIndex: idx });
    idx += 1;
  }
  return map;
}

export function getFilledTeams(
  maxParticipants: number,
  matchType: string,
  participants: AdminSlotParticipant[],
): TeamGroup[] {
  const slotMap = buildSlotMap(maxParticipants, participants);
  const teamSize = teamSizeFor(matchType);
  const teamCount = Math.floor(maxParticipants / teamSize);
  const teams: TeamGroup[] = [];

  for (let tn = 1; tn <= teamCount; tn++) {
    const indices = teamSlotIndices(tn, matchType, maxParticipants);
    const players = indices
      .map((si) => {
        const p = slotMap.get(si);
        return p ? { ...p, slotIndex: si } : null;
      })
      .filter((p): p is AdminSlotParticipant & { slotIndex: number } => !!p);
    if (players.length > 0) teams.push({ teamNumber: tn, players });
  }

  return teams;
}

/** Squad placement = rank of last surviving member (best / lowest rank on the team). */
export function teamFinishRank(players: { rank?: number }[]): number | null {
  const ranks = players
    .map((p) => p.rank)
    .filter((r): r is number => typeof r === "number" && r >= 1);
  if (ranks.length === 0) return null;
  return Math.min(...ranks);
}

/** Team ordinal among all teams (1 = best) from individual player ranks. */
export function computeTeamOrdinals(teams: TeamGroup[]): Map<number, number> {
  const scored = teams
    .map((t) => ({ teamNumber: t.teamNumber, finish: teamFinishRank(t.players) }))
    .filter((t): t is { teamNumber: number; finish: number } => t.finish != null)
    .sort((a, b) => a.finish - b.finish);

  const ordinals = new Map<number, number>();
  scored.forEach((t, i) => ordinals.set(t.teamNumber, i + 1));
  return ordinals;
}

export function calcKillCoins(kills: number, prizePool: PrizePool | undefined): number {
  return kills * (prizePool?.coinsPerKill ?? 0);
}

export function calcRankRewardCoins(
  teamOrdinal: number,
  prizePool: PrizePool | undefined,
): number {
  if (!prizePool) return 0;
  for (const r of prizePool.rankRewards ?? []) {
    if (teamOrdinal >= r.fromRank && teamOrdinal <= r.toRank) return r.coins;
  }
  return 0;
}

export function splitRankRewardAmongPlayers(
  rankReward: number,
  players: { id: string; kills: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  if (rankReward <= 0 || players.length === 0) return out;

  const totalKills = players.reduce((s, p) => s + p.kills, 0);
  if (players.length === 1) {
    out.set(players[0].id, rankReward);
    return out;
  }
  if (totalKills > 0) {
    for (const p of players) {
      const share = Math.floor((rankReward * p.kills) / totalKills);
      if (share > 0) out.set(p.id, share);
    }
    return out;
  }
  const share = Math.floor(rankReward / players.length);
  for (const p of players) {
    if (share > 0) out.set(p.id, share);
  }
  return out;
}

export function calcPlayerWinnings(
  player: AdminSlotParticipant,
  team: TeamGroup,
  teamOrdinal: number | null,
  prizePool: PrizePool | undefined,
  allTeams: TeamGroup[],
): number {
  const kills = player.teamMembers?.[0]?.kills ?? 0;
  let coins = calcKillCoins(kills, prizePool);

  const ordinals = computeTeamOrdinals(allTeams);
  const ordinal = ordinals.get(team.teamNumber) ?? teamOrdinal;
  if (ordinal != null) {
    const rankReward = calcRankRewardCoins(ordinal, prizePool);
    const rankShare = splitRankRewardAmongPlayers(
      rankReward,
      team.players.map((p) => ({
        id: p.id,
        kills: p.teamMembers?.[0]?.kills ?? 0,
      })),
    );
    coins += rankShare.get(player.id) ?? 0;
  }
  return coins;
}

export function sortTeamsForLeaderboard(teams: TeamGroup[]): TeamGroup[] {
  const ordinals = computeTeamOrdinals(teams);
  return [...teams].sort((a, b) => {
    const oa = ordinals.get(a.teamNumber) ?? 9999;
    const ob = ordinals.get(b.teamNumber) ?? 9999;
    return oa - ob;
  });
}

export function participantTeamNumber(
  participant: AdminSlotParticipant,
  matchType: string,
): number {
  if (typeof participant.slotIndex === "number") {
    return slotToTeamNumber(participant.slotIndex, matchType);
  }
  return 1;
}
