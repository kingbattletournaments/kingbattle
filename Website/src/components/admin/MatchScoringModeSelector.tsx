"use client";

import {
  DEFAULT_MANUAL_ENTRY_OPTIONS,
  SCORING_MODE_LABELS,
  type ManualEntryOptions,
  type PrizePool,
  type ScoringMode,
  computeScoringMode,
  hasActiveRankRewards,
  resolveScoringMode,
} from "@/lib/match-scoring";

export function MatchScoringModeSelector({
  prizePool,
  scoringMode,
  manualEntryOptions,
  onScoringModeChange,
  onManualEntryOptionsChange,
  disabled = false,
}: {
  prizePool?: PrizePool;
  scoringMode?: ScoringMode | string | null;
  manualEntryOptions?: ManualEntryOptions;
  onScoringModeChange: (mode: ScoringMode) => void;
  onManualEntryOptionsChange: (opts: ManualEntryOptions) => void;
  disabled?: boolean;
}) {
  const derivedDefault = computeScoringMode(
    prizePool,
    hasActiveRankRewards(prizePool?.rankRewards),
  );
  const activeMode = resolveScoringMode(scoringMode, prizePool);
  const manualOpts = manualEntryOptions ?? DEFAULT_MANUAL_ENTRY_OPTIONS;

  const modes: ScoringMode[] = ["kills_only", "rank_only", "rank_kills", "manual"];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <h3 className="mb-1 text-sm font-semibold text-zinc-800">Match management mode</h3>
      <p className="mb-4 text-xs text-zinc-500">
        Controls which fields you enter when finishing the match and how the app leaderboard is sorted.
        Suggested default:{" "}
        <span className="font-medium text-zinc-700">{SCORING_MODE_LABELS[derivedDefault]}</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        {modes.map((mode) => {
          const isActive = activeMode === mode;
          const isSuggested = derivedDefault === mode && activeMode !== "manual";
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onScoringModeChange(mode)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
              } disabled:opacity-50`}
            >
              {SCORING_MODE_LABELS[mode]}
              {isSuggested && !isActive ? " (suggested)" : ""}
            </button>
          );
        })}
      </div>

      {activeMode === "manual" && (
        <div className="mt-4 space-y-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 p-3">
          <p className="text-xs font-medium text-zinc-600">Manual entry options</p>
          {(
            [
              ["enterKills", "Enter kills"],
              ["enterRank", "Enter ranks"],
              ["enterCustomWinnings", "Enter custom winning amounts"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={manualOpts[key]}
                disabled={disabled}
                onChange={(e) =>
                  onManualEntryOptionsChange({ ...manualOpts, [key]: e.target.checked })
                }
                className="rounded border-zinc-300"
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
