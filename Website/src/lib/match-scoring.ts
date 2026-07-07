export type ScoringMode = "kills_only" | "rank_only" | "rank_kills" | "manual";

export type RankReward = { fromRank: number; toRank: number; coins: number };

export type PrizePool = {
  coinsPerKill: number;
  totalPrizePool?: number;
  rankRewards: RankReward[];
};

export type ManualEntryOptions = {
  enterKills: boolean;
  enterRank: boolean;
  enterCustomWinnings: boolean;
};

export const DEFAULT_MANUAL_ENTRY_OPTIONS: ManualEntryOptions = {
  enterKills: true,
  enterRank: true,
  enterCustomWinnings: true,
};

export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  kills_only: "Kills only",
  rank_only: "Rank only",
  rank_kills: "Rank + kills",
  manual: "Manual",
};

export function hasActiveRankRewards(rewards: RankReward[] | undefined): boolean {
  return (rewards ?? []).some(
    (r) => r.coins > 0 && r.fromRank > 0 && r.toRank >= r.fromRank,
  );
}

export function visibleRankRewards(rewards: RankReward[] | undefined): RankReward[] {
  return (rewards ?? []).filter(
    (r) => r.coins > 0 && r.fromRank > 0 && r.toRank >= r.fromRank,
  );
}

export function computeScoringMode(
  prizePool: PrizePool | undefined,
  rankRewardsEnabled: boolean,
): ScoringMode {
  const cpk = prizePool?.coinsPerKill ?? 0;
  const ranks = rankRewardsEnabled && hasActiveRankRewards(prizePool?.rankRewards);
  if (ranks && cpk > 0) return "rank_kills";
  if (ranks && cpk === 0) return "rank_only";
  return "kills_only";
}

export function resolveScoringMode(
  stored: ScoringMode | string | null | undefined,
  prizePool: PrizePool | undefined,
): ScoringMode {
  if (
    stored === "kills_only" ||
    stored === "rank_only" ||
    stored === "rank_kills" ||
    stored === "manual"
  ) {
    return stored;
  }
  return computeScoringMode(prizePool, hasActiveRankRewards(prizePool?.rankRewards));
}

export function rankRewardForRank(
  rank: number | undefined,
  prizePool: PrizePool | undefined,
): number {
  if (typeof rank !== "number" || rank < 1 || !prizePool) return 0;
  for (const r of visibleRankRewards(prizePool.rankRewards)) {
    if (rank >= r.fromRank && rank <= r.toRank) return r.coins;
  }
  return 0;
}

export function calcParticipantPayout(
  totalKills: number,
  rank: number | undefined,
  prizePool: PrizePool | undefined,
  scoringMode: ScoringMode,
  customWinnings?: number,
  manualOptions?: ManualEntryOptions,
): number {
  const cpk = prizePool?.coinsPerKill ?? 0;

  if (scoringMode === "manual") {
    if (typeof customWinnings === "number" && customWinnings >= 0) return customWinnings;
    const opts = manualOptions ?? DEFAULT_MANUAL_ENTRY_OPTIONS;
    let coins = 0;
    if (opts.enterKills) coins += totalKills * cpk;
    if (opts.enterRank) coins += rankRewardForRank(rank, prizePool);
    return coins;
  }

  switch (scoringMode) {
    case "kills_only":
      return totalKills * cpk;
    case "rank_only":
      return rankRewardForRank(rank, prizePool);
    case "rank_kills":
      return totalKills * cpk + rankRewardForRank(rank, prizePool);
    default:
      return totalKills * cpk;
  }
}

export function shouldShowRankFields(scoringMode: ScoringMode, manualOptions?: ManualEntryOptions): boolean {
  if (scoringMode === "rank_only" || scoringMode === "rank_kills") return true;
  if (scoringMode === "manual") return manualOptions?.enterRank ?? false;
  return false;
}

export function shouldShowKillFields(scoringMode: ScoringMode, manualOptions?: ManualEntryOptions): boolean {
  if (scoringMode === "kills_only" || scoringMode === "rank_kills") return true;
  if (scoringMode === "manual") return manualOptions?.enterKills ?? false;
  return false;
}

export function shouldShowCustomWinnings(scoringMode: ScoringMode, manualOptions?: ManualEntryOptions): boolean {
  return scoringMode === "manual" && (manualOptions?.enterCustomWinnings ?? false);
}

export function sortParticipantsForLeaderboard<
  T extends { rank?: number; teamMembers?: { kills?: number }[] },
>(participants: T[], scoringMode: ScoringMode): T[] {
  const totalKills = (p: T) =>
    (p.teamMembers ?? []).reduce((sum, m) => sum + (m.kills ?? 0), 0);

  if (scoringMode === "kills_only") {
    return [...participants].sort((a, b) => {
      const diff = totalKills(b) - totalKills(a);
      if (diff !== 0) return diff;
      return (a.rank ?? 9999) - (b.rank ?? 9999);
    });
  }

  return [...participants].sort((a, b) => {
    const ra = a.rank ?? 9999;
    const rb = b.rank ?? 9999;
    if (ra !== rb) return ra - rb;
    return totalKills(b) - totalKills(a);
  });
}

export function normalizeManualEntryOptions(raw: unknown): ManualEntryOptions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MANUAL_ENTRY_OPTIONS };
  const o = raw as Partial<ManualEntryOptions>;
  return {
    enterKills: o.enterKills !== false,
    enterRank: o.enterRank !== false,
    enterCustomWinnings: o.enterCustomWinnings !== false,
  };
}
