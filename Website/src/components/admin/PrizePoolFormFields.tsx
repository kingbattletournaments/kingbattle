"use client";

import {
  computeScoringMode,
  hasActiveRankRewards,
  type RankReward,
} from "@/lib/match-scoring";

function nextRankRange(prev: RankReward[]): RankReward {
  const maxTo = prev.length > 0 ? Math.max(...prev.map((r) => r.toRank)) : 0;
  return { fromRank: maxTo + 1, toRank: maxTo + 1, coins: 0 };
}

function RankRewardsEditor({
  value,
  onChange,
}: {
  value: RankReward[];
  onChange: (next: RankReward[]) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-zinc-500">Rank rewards (coins per rank range)</label>
      <p className="text-[11px] text-zinc-500">
        Add ranges like rank 5–10 with a prize for each player in that range. Ranks with 0 coins are ignored in the app.
      </p>
      {value.length === 0 && (
        <p className="text-sm text-zinc-500">No rank ranges yet. Add one below.</p>
      )}
      {value.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            value={r.fromRank}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, fromRank: Number(e.target.value) || 1 } : x)))
            }
            className="admin-input w-16 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none"
            aria-label={`Range ${i + 1} from rank`}
          />
          <span className="text-zinc-500">-</span>
          <input
            type="number"
            min="1"
            value={r.toRank}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, toRank: Number(e.target.value) || 1 } : x)))
            }
            className="admin-input w-16 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none"
            aria-label={`Range ${i + 1} to rank`}
          />
          <span className="text-zinc-500">→</span>
          <input
            type="number"
            min="0"
            value={r.coins}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, coins: Number(e.target.value) || 0 } : x)))
            }
            className="admin-input w-20 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none"
            placeholder="coins"
          />
          <span className="text-zinc-500 text-sm">coins</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20"
            aria-label="Remove range"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, nextRankRange(value)])}
        className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
      >
        + Add rank range
      </button>
    </div>
  );
}

export function PrizePoolFormFields({
  coinsPerKill,
  totalPrizePool,
  rankRewardsEnabled,
  rankRewards,
  onCoinsPerKillChange,
  onTotalPrizePoolChange,
  onRankRewardsEnabledChange,
  onRankRewardsChange,
}: {
  coinsPerKill: string;
  totalPrizePool: string;
  rankRewardsEnabled: boolean;
  rankRewards: RankReward[];
  onCoinsPerKillChange: (value: string) => void;
  onTotalPrizePoolChange: (value: string) => void;
  onRankRewardsEnabledChange: (enabled: boolean) => void;
  onRankRewardsChange: (rewards: RankReward[]) => void;
}) {
  const previewMode = computeScoringMode(
    {
      coinsPerKill: Number(coinsPerKill) || 0,
      totalPrizePool: totalPrizePool ? Number(totalPrizePool) : 0,
      rankRewards: rankRewardsEnabled ? rankRewards : [],
    },
    rankRewardsEnabled,
  );

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/10 p-5">
      <h3 className="mb-3 text-sm font-semibold text-zinc-600">Prize Pool</h3>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Total prize pool (coins)</label>
          <input
            type="number"
            min="0"
            value={totalPrizePool}
            onChange={(e) => onTotalPrizePoolChange(e.target.value)}
            className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-zinc-900 outline-none"
            placeholder="e.g. 500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Coins per kill</label>
          <input
            type="number"
            min="0"
            value={coinsPerKill}
            onChange={(e) => onCoinsPerKillChange(e.target.value)}
            className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-zinc-900 outline-none"
            placeholder="5"
          />
        </div>
      </div>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={rankRewardsEnabled}
          onChange={(e) => {
            onRankRewardsEnabledChange(e.target.checked);
            if (!e.target.checked) onRankRewardsChange([]);
          }}
          className="rounded border-zinc-300"
        />
        Enable rank-based rewards
      </label>

      {rankRewardsEnabled && (
        <RankRewardsEditor value={rankRewards} onChange={onRankRewardsChange} />
      )}

      <p className="mt-4 text-[11px] text-zinc-500">
        Default scoring mode:{" "}
        <span className="font-medium text-zinc-700">
          {previewMode === "rank_kills"
            ? "Rank + kills"
            : previewMode === "rank_only"
              ? "Rank only"
              : "Kills only"}
        </span>
        {rankRewardsEnabled && !hasActiveRankRewards(rankRewards) && (
          <span> (add at least one rank range with coins &gt; 0)</span>
        )}
      </p>
    </div>
  );
}
