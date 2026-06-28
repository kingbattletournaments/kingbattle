"use client";

import { type Dispatch, type SetStateAction } from "react";
import { teamSizeFor } from "@/lib/match-slots";
import {
  type AdminSlotParticipant,
  type PrizePool,
  type TeamSlotEntry,
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

function SlotCell({
  slotPositionInTeam,
  participant,
  readOnly,
  isOngoing,
  leaderboardMode,
  kills,
  rank,
  winnings,
  onKillsChange,
  onRankChange,
}: {
  slotPositionInTeam: number;
  participant: AdminSlotParticipant | null;
  readOnly: boolean;
  isOngoing: boolean;
  leaderboardMode: boolean;
  kills: string;
  rank: string;
  winnings?: number;
  onKillsChange?: (v: string) => void;
  onRankChange?: (v: string) => void;
}) {
  const filled = !!participant;
  const ign = participant?.teamMembers?.[0]?.inGameName?.trim();
  const uid = participant?.teamMembers?.[0]?.inGameUid?.trim();

  return (
    <div className="flex min-w-0 flex-col">
      <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Slot {slotPositionInTeam}
      </span>
      <div
        className={`flex min-h-[6.5rem] flex-1 flex-col rounded-lg border px-2.5 py-2 ${
          filled
            ? "border-zinc-200 bg-white shadow-sm"
            : "border-dashed border-zinc-200 bg-zinc-50/80"
        }`}
      >
        {!filled ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-xs font-medium text-zinc-400">Empty</span>
          </div>
        ) : (
          <>
            {participant.userId && (
              <p className="truncate text-[10px] font-mono text-zinc-500" title={participant.userId}>
                {participant.userId}
              </p>
            )}
            <p className="mt-1 truncate text-sm font-semibold text-zinc-900" title={ign || undefined}>
              {ign || "—"}
            </p>
            <p className="truncate text-xs text-zinc-500" title={uid || undefined}>
              {uid || "—"}
            </p>

            {isOngoing && !readOnly && (
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                  Kills
                  <input
                    type="text"
                    inputMode="numeric"
                    value={kills}
                    placeholder="0"
                    onChange={(e) => onKillsChange?.(e.target.value.replace(/\D/g, ""))}
                    className="admin-input w-12 rounded-md px-1.5 py-1 text-center text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                  Rank
                  <input
                    type="text"
                    inputMode="numeric"
                    value={rank}
                    placeholder="—"
                    onChange={(e) => onRankChange?.(e.target.value.replace(/\D/g, ""))}
                    className="admin-input w-12 rounded-md px-1.5 py-1 text-center text-xs"
                  />
                </label>
              </div>
            )}

            {leaderboardMode && rank && (
              <p className="mt-auto pt-2 text-[10px] font-medium text-zinc-600">Rank #{rank}</p>
            )}

            {leaderboardMode && parseKillsInput(kills) > 0 && (
              <p className="text-[10px] text-zinc-500">{parseKillsInput(kills)} kills</p>
            )}

            {leaderboardMode && typeof winnings === "number" && winnings > 0 && (
              <span className="mt-2 self-start rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {winnings} coins
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TeamBox({
  teamNumber,
  teamOrdinal,
  slots,
  readOnly,
  isOngoing,
  leaderboardMode,
  localKills,
  localRank,
  setLocalKills,
  setLocalRank,
  prizePool,
  allTeams,
  matchType,
}: {
  teamNumber: number;
  teamOrdinal?: number;
  slots: TeamSlotEntry[];
  readOnly: boolean;
  isOngoing: boolean;
  leaderboardMode: boolean;
  localKills: Record<string, string>;
  localRank: Record<string, string>;
  setLocalKills: Dispatch<SetStateAction<Record<string, string>>>;
  setLocalRank: Dispatch<SetStateAction<Record<string, string>>>;
  prizePool?: PrizePool;
  allTeams: ReturnType<typeof getFilledTeams>;
  matchType: string;
}) {
  const players = slots
    .map((s) => s.participant)
    .filter((p): p is AdminSlotParticipant & { slotIndex: number } => !!p);
  const teamForCalc = { teamNumber, slots, players };

  const ts = teamSizeFor(matchType);
  const gridCols = ts === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4";

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
          Team {teamNumber}
        </h4>
        {leaderboardMode && teamOrdinal != null && (
          <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
            Placement #{teamOrdinal}
          </span>
        )}
      </div>

      <div className={`grid gap-3 ${gridCols}`}>
        {slots.map((slot) => {
          const p = slot.participant;
          const killsDisplay = p ? (localKills[p.id] ?? "") : "";
          const rankDisplay = p ? (localRank[p.id] ?? "") : "";

          const winnings =
            p && leaderboardMode
              ? calcPlayerWinnings(
                  {
                    ...p,
                    rank: parseRankInput(rankDisplay) ?? p.rank,
                    teamMembers: [
                      {
                        ...p.teamMembers[0],
                        kills: parseKillsInput(killsDisplay),
                      },
                    ],
                  },
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
            <SlotCell
              key={slot.globalSlotIndex}
              slotPositionInTeam={slot.slotPositionInTeam}
              participant={p}
              readOnly={readOnly}
              isOngoing={isOngoing}
              leaderboardMode={leaderboardMode}
              kills={killsDisplay}
              rank={rankDisplay}
              winnings={winnings}
              onKillsChange={
                p ? (v) => setLocalKills((prev) => ({ ...prev, [p.id]: v })) : undefined
              }
              onRankChange={
                p ? (v) => setLocalRank((prev) => ({ ...prev, [p.id]: v })) : undefined
              }
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
              Fill kills and rank for each player, then click Finish Match.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
              <SlotCell
                key={p.id}
                slotPositionInTeam={p.slotIndex}
                participant={p}
                readOnly={readOnly}
                isOngoing={isOngoing}
                leaderboardMode={leaderboardMode}
                kills={killsDisplay}
                rank={rankDisplay}
                winnings={leaderboardMode ? killCoins + rankCoins : undefined}
                onKillsChange={(v) => setLocalKills((prev) => ({ ...prev, [p.id]: v }))}
                onRankChange={(v) => setLocalRank((prev) => ({ ...prev, [p.id]: v }))}
              />
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
            Slots are numbered 1–{teamSize} within each team. Enter kills and individual rank per player, then finish the match.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teamsForDisplay.map((team) => (
          <TeamBox
            key={team.teamNumber}
            teamNumber={team.teamNumber}
            teamOrdinal={ordinals.get(team.teamNumber)}
            slots={team.slots}
            readOnly={readOnly}
            isOngoing={isOngoing}
            leaderboardMode={leaderboardMode}
            localKills={localKills}
            localRank={localRank}
            setLocalKills={setLocalKills}
            setLocalRank={setLocalRank}
            prizePool={prizePool}
            allTeams={teamsWithRanks}
            matchType={matchType}
          />
        ))}
      </div>
    </div>
  );
}

export type { AdminSlotParticipant };
