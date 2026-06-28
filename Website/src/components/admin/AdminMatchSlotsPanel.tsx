"use client";

import { type Dispatch, type SetStateAction } from "react";
import { teamSizeFor } from "@/lib/match-slots";
import {
  type AdminSlotParticipant,
  type PrizePool,
  calcKillCoins,
  calcPlayerWinnings,
  computeTeamOrdinals,
  getFilledTeams,
  sortTeamsForLeaderboard,
} from "@/lib/admin-match-teams";

export function parseKillsInput(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function parseRankInput(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

function PlayerRow({
  name,
  kills,
  rank,
  readOnly,
  isOngoing,
  showWinnings,
  winnings,
  onKillsChange,
  onRankChange,
}: {
  name: string;
  kills?: string;
  rank?: string;
  readOnly: boolean;
  isOngoing: boolean;
  showWinnings?: boolean;
  winnings?: number;
  onKillsChange?: (v: string) => void;
  onRankChange?: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-100 py-2.5 last:border-0">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{name || "—"}</span>

      {isOngoing && !readOnly && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Kills
            <input
              type="text"
              inputMode="numeric"
              value={kills ?? ""}
              placeholder="0"
              onChange={(e) => onKillsChange?.(e.target.value.replace(/\D/g, ""))}
              className="admin-input w-14 rounded-lg px-2 py-1.5 text-center text-sm"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Rank
            <input
              type="text"
              inputMode="numeric"
              value={rank ?? ""}
              placeholder="—"
              onChange={(e) => onRankChange?.(e.target.value.replace(/\D/g, ""))}
              className="admin-input w-14 rounded-lg px-2 py-1.5 text-center text-sm"
            />
          </label>
        </>
      )}

      {!isOngoing && rank && (
        <span className="text-xs font-semibold text-zinc-500">Rank #{rank}</span>
      )}

      {!isOngoing && parseKillsInput(kills) > 0 && (
        <span className="text-xs text-zinc-500">{parseKillsInput(kills)} kills</span>
      )}

      {showWinnings && typeof winnings === "number" && winnings > 0 && (
        <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-800">
          {winnings} coins
        </span>
      )}
    </div>
  );
}

function TeamBox({
  teamOrdinal,
  players,
  readOnly,
  isOngoing,
  leaderboardMode,
  localKills,
  localRank,
  setLocalKills,
  setLocalRank,
  prizePool,
  allTeams,
  teamNumber,
}: {
  teamOrdinal?: number;
  players: (AdminSlotParticipant & { slotIndex: number })[];
  readOnly: boolean;
  isOngoing: boolean;
  leaderboardMode: boolean;
  localKills: Record<string, string>;
  localRank: Record<string, string>;
  setLocalKills: Dispatch<SetStateAction<Record<string, string>>>;
  setLocalRank: Dispatch<SetStateAction<Record<string, string>>>;
  prizePool?: PrizePool;
  allTeams: ReturnType<typeof getFilledTeams>;
  teamNumber: number;
}) {
  const teamForCalc = { teamNumber, players };

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
      {leaderboardMode && teamOrdinal != null && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold text-white">
            #{teamOrdinal}
          </span>
        </div>
      )}

      <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-100 bg-white px-3">
        {players.map((p) => {
          const ign = p.teamMembers?.[0]?.inGameName?.trim() || "—";
          const killsDisplay = localKills[p.id] ?? "";
          const rankDisplay = localRank[p.id] ?? "";

          const previewPlayer: AdminSlotParticipant = {
            ...p,
            rank: parseRankInput(rankDisplay) ?? p.rank,
            teamMembers: [
              {
                ...p.teamMembers[0],
                kills: parseKillsInput(killsDisplay),
              },
            ],
          };

          const winnings = leaderboardMode
            ? calcPlayerWinnings(
                previewPlayer,
                teamForCalc,
                teamOrdinal ?? null,
                prizePool,
                allTeams.map((t) => ({
                  ...t,
                  players: t.players.map((pl) => ({
                    ...pl,
                    rank: parseRankInput(localRank[pl.id] ?? "") ?? pl.rank,
                    teamMembers: [
                      {
                        ...pl.teamMembers[0],
                        kills: parseKillsInput(localKills[pl.id] ?? ""),
                      },
                    ],
                  })),
                })),
              )
            : undefined;

          return (
            <PlayerRow
              key={p.id}
              name={ign}
              kills={killsDisplay}
              rank={rankDisplay}
              readOnly={readOnly}
              isOngoing={isOngoing}
              showWinnings={leaderboardMode}
              winnings={winnings}
              onKillsChange={(v) => setLocalKills((prev) => ({ ...prev, [p.id]: v }))}
              onRankChange={(v) => setLocalRank((prev) => ({ ...prev, [p.id]: v }))}
            />
          );
        })}
      </div>
    </article>
  );
}

export function AdminMatchSlotsPanel({
  matchType = "solo",
  maxParticipants,
  prizePool,
  participants,
  isOngoing,
  readOnly = false,
  leaderboardMode = false,
  localKills,
  setLocalKills,
  localRank,
  setLocalRank,
}: {
  matchType?: string;
  maxParticipants: number;
  prizePool?: PrizePool;
  participants: AdminSlotParticipant[];
  isOngoing: boolean;
  readOnly?: boolean;
  leaderboardMode?: boolean;
  localKills: Record<string, string>;
  setLocalKills: Dispatch<SetStateAction<Record<string, string>>>;
  localRank: Record<string, string>;
  setLocalRank: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const teamSize = teamSizeFor(matchType);
  const isTeamMode = teamSize > 1;
  const filledTeams = getFilledTeams(maxParticipants, matchType, participants);
  const filledCount = participants.length;

  const teamsWithRanks = filledTeams.map((t) => ({
    ...t,
    players: t.players.map((p) => ({
      ...p,
      rank: parseRankInput(localRank[p.id] ?? "") ?? p.rank,
    })),
  }));

  const teamsForDisplay = leaderboardMode
    ? sortTeamsForLeaderboard(teamsWithRanks)
    : filledTeams;

  const ordinals = computeTeamOrdinals(teamsWithRanks);

  const panelTitle = leaderboardMode
    ? `Scoreboard (${filledTeams.length} team${filledTeams.length === 1 ? "" : "s"})`
    : isOngoing
      ? `Enter results (${filledCount} player${filledCount === 1 ? "" : "s"})`
      : `Joined players (${filledCount})`;

  if (filledCount === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
          No players registered yet.
        </p>
      </div>
    );
  }

  if (!isTeamMode) {
    const soloPlayers = filledTeams[0]?.players ?? [];
    const sortedSolo = leaderboardMode
      ? [...soloPlayers].sort((a, b) => {
          const ra = parseRankInput(localRank[a.id] ?? "") ?? a.rank ?? 9999;
          const rb = parseRankInput(localRank[b.id] ?? "") ?? b.rank ?? 9999;
          return ra - rb;
        })
      : soloPlayers;

    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-800">{panelTitle}</h3>
          {isOngoing && !readOnly && (
            <p className="mt-1 text-xs text-zinc-500">
              Fill kills and rank for each player, then click Finish Match. Changes are saved when you finish.
            </p>
          )}
        </div>
        <div className="space-y-3">
          {sortedSolo.map((p) => {
            const ign = p.teamMembers?.[0]?.inGameName?.trim() || "—";
            const killsDisplay = localKills[p.id] ?? "";
            const rankDisplay = localRank[p.id] ?? "";
            const kills = parseKillsInput(killsDisplay);
            const rank = parseRankInput(rankDisplay) ?? p.rank;
            const killCoins = calcKillCoins(kills, prizePool);
            let rankCoins = 0;
            if (typeof rank === "number" && prizePool) {
              for (const r of prizePool.rankRewards ?? []) {
                if (rank >= r.fromRank && rank <= r.toRank) {
                  rankCoins = r.coins;
                  break;
                }
              }
            }

            return (
              <article key={p.id} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                {leaderboardMode && typeof rank === "number" && (
                  <span className="mb-2 inline-block rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold text-white">
                    #{rank}
                  </span>
                )}
                <PlayerRow
                  name={ign}
                  kills={killsDisplay}
                  rank={rankDisplay}
                  readOnly={readOnly}
                  isOngoing={isOngoing}
                  showWinnings={leaderboardMode}
                  winnings={killCoins + rankCoins}
                  onKillsChange={(v) => setLocalKills((prev) => ({ ...prev, [p.id]: v }))}
                  onRankChange={(v) => setLocalRank((prev) => ({ ...prev, [p.id]: v }))}
                />
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-800">{panelTitle}</h3>
        {isOngoing && !readOnly && (
          <p className="mt-1 text-xs text-zinc-500">
            Enter kills and individual rank per player. Team order is calculated automatically on finish.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teamsForDisplay.map((team) => (
          <TeamBox
            key={team.teamNumber}
            teamNumber={team.teamNumber}
            teamOrdinal={ordinals.get(team.teamNumber)}
            players={team.players}
            readOnly={readOnly}
            isOngoing={isOngoing}
            leaderboardMode={leaderboardMode}
            localKills={localKills}
            localRank={localRank}
            setLocalKills={setLocalKills}
            setLocalRank={setLocalRank}
            prizePool={prizePool}
            allTeams={teamsWithRanks}
          />
        ))}
      </div>
    </div>
  );
}

export type { AdminSlotParticipant };
