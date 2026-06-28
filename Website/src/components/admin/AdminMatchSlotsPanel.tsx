"use client";

import { type Dispatch, type SetStateAction } from "react";
import {
  teamCount as getTeamCount,
  teamSizeFor,
  teamSlotIndices,
} from "@/lib/match-slots";

type RankReward = { fromRank: number; toRank: number; coins: number };
type PrizePool = { coinsPerKill: number; totalPrizePool?: number; rankRewards: RankReward[] };

export type AdminSlotParticipant = {
  id: string;
  userId: string;
  slotIndex?: number;
  teamMembers: { inGameName: string; inGameUid: string; kills?: number }[];
  rank?: number;
};

function calcCoinsForPosition(
  position: number,
  totalKills: number,
  prizePool: PrizePool | undefined,
): number {
  if (!prizePool) return 0;
  let coins = totalKills * (prizePool.coinsPerKill ?? 0);
  for (const r of prizePool.rankRewards ?? []) {
    if (position >= r.fromRank && position <= r.toRank) {
      coins += r.coins;
      break;
    }
  }
  return coins;
}

function buildSlotMap(
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

function countFilledSlots(slotMap: Map<number, AdminSlotParticipant | null>): number {
  return Array.from(slotMap.values()).filter(Boolean).length;
}

function SlotBox({
  slotIndex,
  participant,
  readOnly,
  isOngoing,
  leaderboardMode,
  kills,
  onKillsChange,
  onUpdateKills,
  updating,
  showRank,
  rankVal,
  onRankChange,
  onUpdateRank,
  rankUpdating,
  coins,
  position,
}: {
  slotIndex: number;
  participant: AdminSlotParticipant | null;
  readOnly: boolean;
  isOngoing: boolean;
  leaderboardMode: boolean;
  kills: number;
  onKillsChange?: (v: number) => void;
  onUpdateKills?: () => void;
  updating?: boolean;
  showRank?: boolean;
  rankVal?: number | "";
  onRankChange?: (v: number | "") => void;
  onUpdateRank?: () => void;
  rankUpdating?: boolean;
  coins?: number;
  position?: number;
}) {
  const filled = !!participant;
  const member = participant?.teamMembers?.[0];
  const ign = member?.inGameName?.trim();
  const uid = member?.inGameUid?.trim();
  const serverKills = member?.kills ?? 0;
  const killsChanged = filled && kills !== serverKills;
  const rankChanged =
    filled &&
    typeof rankVal === "number" &&
    rankVal >= 1 &&
    rankVal !== participant?.rank;
  const hasBeenUpdated =
    filled &&
    ((typeof participant?.rank === "number" && participant.rank >= 1) || serverKills > 0);

  return (
    <div className="flex min-w-0 flex-col">
      <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Slot {slotIndex}
      </span>
      <div
        className={`flex min-h-[7.5rem] flex-1 flex-col rounded-lg border px-3 py-2.5 transition ${
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
            {(leaderboardMode || hasBeenUpdated) && typeof position === "number" && (
              <span className="mb-1.5 self-start rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
                #{position}
              </span>
            )}
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
                    type="number"
                    min={0}
                    value={kills}
                    onChange={(e) => onKillsChange?.(Number(e.target.value) || 0)}
                    className="admin-input w-12 rounded-md px-1.5 py-1 text-center text-xs"
                  />
                </label>
                {killsChanged && (
                  <button
                    type="button"
                    onClick={onUpdateKills}
                    disabled={updating}
                    className="rounded-md admin-btn-primary px-2 py-0.5 text-[10px] font-medium disabled:opacity-50"
                  >
                    {updating ? "…" : "Save"}
                  </button>
                )}
              </div>
            )}

            {readOnly && kills > 0 && (
              <p className="mt-auto pt-2 text-[10px] font-medium text-zinc-600">{kills} kills</p>
            )}

            {showRank && isOngoing && !readOnly && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                  Rank
                  <input
                    type="number"
                    min={1}
                    value={rankVal === "" ? "" : rankVal}
                    onChange={(e) => {
                      const v = e.target.value;
                      onRankChange?.(v === "" ? "" : Math.max(1, Number(v) || 1));
                    }}
                    placeholder="—"
                    className="admin-input w-12 rounded-md px-1.5 py-1 text-center text-xs"
                  />
                </label>
                {rankChanged && (
                  <button
                    type="button"
                    onClick={onUpdateRank}
                    disabled={rankUpdating}
                    className="rounded-md admin-btn-primary px-2 py-0.5 text-[10px] font-medium disabled:opacity-50"
                  >
                    {rankUpdating ? "…" : "Save"}
                  </button>
                )}
              </div>
            )}

            {(hasBeenUpdated || leaderboardMode) && typeof coins === "number" && coins > 0 && (
              <span className="mt-2 self-start rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                {coins} coins
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TeamCard({
  teamNumber,
  slotIndices,
  slotMap,
  matchType,
  readOnly,
  isOngoing,
  leaderboardMode,
  localKills,
  setLocalKills,
  localRank,
  setLocalRank,
  updatingParticipant,
  onUpdateParticipant,
  getKills,
  prizePool,
  teamCountForRank,
}: {
  teamNumber: number;
  slotIndices: number[];
  slotMap: Map<number, AdminSlotParticipant | null>;
  matchType: string;
  readOnly: boolean;
  isOngoing: boolean;
  leaderboardMode: boolean;
  localKills: Record<string, number[]>;
  setLocalKills: Dispatch<SetStateAction<Record<string, number[]>>>;
  localRank: Record<string, number | "">;
  setLocalRank: Dispatch<SetStateAction<Record<string, number | "">>>;
  updatingParticipant: string | null;
  onUpdateParticipant: (p: AdminSlotParticipant) => void;
  getKills: (p: AdminSlotParticipant) => number[];
  prizePool: PrizePool | undefined;
  teamCountForRank: number;
}) {
  const filled = slotIndices
    .map((si) => slotMap.get(si))
    .filter((p): p is AdminSlotParticipant => !!p);
  const teamRep = filled[0] ?? null;
  const teamRank =
    teamRep && typeof (localRank[teamRep.id] ?? teamRep.rank) === "number"
      ? (localRank[teamRep.id] as number)
      : teamRep?.rank;
  const totalKills = filled.reduce((sum, p) => sum + (getKills(p)[0] ?? 0), 0);
  const position = typeof teamRank === "number" && teamRank >= 1 ? teamRank : undefined;
  const coins =
    position != null ? calcCoinsForPosition(position, totalKills, prizePool) : undefined;
  const hasBeenUpdated =
    filled.length > 0 &&
    (filled.some((p) => (p.teamMembers?.[0]?.kills ?? 0) > 0) ||
      (typeof teamRank === "number" && teamRank >= 1));

  if (leaderboardMode && filled.length === 0) return null;

  const ts = teamSizeFor(matchType);
  const gridCols = ts === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4";

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
          Team {teamNumber}
        </h4>
        {leaderboardMode && position != null && (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
            Rank #{position}
          </span>
        )}
        {(leaderboardMode || hasBeenUpdated) && typeof coins === "number" && coins > 0 && (
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            {coins} coins · {totalKills} kills
          </span>
        )}
      </div>

      <div className={`grid gap-3 ${gridCols}`}>
        {slotIndices.map((slotIndex) => {
          const p = slotMap.get(slotIndex) ?? null;
          const killsArr = p ? getKills(p) : [0];
          return (
            <SlotBox
              key={slotIndex}
              slotIndex={slotIndex}
              participant={p}
              readOnly={readOnly}
              isOngoing={isOngoing}
              leaderboardMode={leaderboardMode}
              kills={killsArr[0] ?? 0}
              onKillsChange={
                p
                  ? (v) =>
                      setLocalKills((prev) => ({
                        ...prev,
                        [p.id]: [v],
                      }))
                  : undefined
              }
              onUpdateKills={p ? () => onUpdateParticipant(p) : undefined}
              updating={p ? updatingParticipant === p.id : false}
            />
          );
        })}
      </div>

      {isOngoing && !readOnly && teamRep && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200/80 pt-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
            Team rank
            <input
              type="number"
              min={1}
              max={teamCountForRank}
              value={localRank[teamRep.id] === "" ? "" : (localRank[teamRep.id] ?? teamRep.rank ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                setLocalRank((prev) => ({
                  ...prev,
                  [teamRep.id]:
                    v === "" ? "" : Math.min(teamCountForRank, Math.max(1, Number(v) || 1)),
                }));
              }}
              placeholder="—"
              className="admin-input w-14 rounded-lg px-2 py-1.5 text-center text-sm"
            />
          </label>
          {typeof localRank[teamRep.id] === "number" &&
            localRank[teamRep.id] !== teamRep.rank && (
              <button
                type="button"
                onClick={() => onUpdateParticipant(teamRep)}
                disabled={!!updatingParticipant}
                className="rounded-lg admin-btn-primary px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {updatingParticipant === teamRep.id ? "Saving…" : "Save rank"}
              </button>
            )}
        </div>
      )}
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
  updatingParticipant,
  onUpdateParticipant,
  getKills,
}: {
  matchType?: string;
  maxParticipants: number;
  prizePool?: PrizePool;
  participants: AdminSlotParticipant[];
  isOngoing: boolean;
  readOnly?: boolean;
  leaderboardMode?: boolean;
  localKills: Record<string, number[]>;
  setLocalKills: Dispatch<SetStateAction<Record<string, number[]>>>;
  localRank: Record<string, number | "">;
  setLocalRank: Dispatch<SetStateAction<Record<string, number | "">>>;
  updatingParticipant: string | null;
  onUpdateParticipant: (p: AdminSlotParticipant) => void;
  getKills: (p: AdminSlotParticipant) => number[];
}) {
  const slotMap = buildSlotMap(maxParticipants, participants);
  const filledCount = countFilledSlots(slotMap);
  const teamSize = teamSizeFor(matchType);
  const teams = getTeamCount(maxParticipants, matchType);
  const isTeamMode = teamSize > 1;

  const panelTitle = leaderboardMode
    ? `Leaderboard (${filledCount} slot${filledCount === 1 ? "" : "s"})`
    : `Joined players (${filledCount} / ${maxParticipants})`;

  const soloSlots = Array.from({ length: maxParticipants }, (_, i) => i + 1);
  const sortedSoloSlots = leaderboardMode
    ? [...soloSlots]
        .filter((si) => slotMap.get(si))
        .sort((a, b) => {
          const pa = slotMap.get(a)!;
          const pb = slotMap.get(b)!;
          const ra = typeof pa.rank === "number" && pa.rank >= 1 ? pa.rank : 9999;
          const rb = typeof pb.rank === "number" && pb.rank >= 1 ? pb.rank : 9999;
          return ra - rb;
        })
    : soloSlots;

  const teamNumbers = leaderboardMode
    ? Array.from({ length: teams }, (_, i) => i + 1)
        .filter((tn) => teamSlotIndices(tn, matchType, maxParticipants).some((si) => slotMap.get(si)))
        .sort((a, b) => {
          const repA = teamSlotIndices(a, matchType, maxParticipants)
            .map((si) => slotMap.get(si))
            .find(Boolean);
          const repB = teamSlotIndices(b, matchType, maxParticipants)
            .map((si) => slotMap.get(si))
            .find(Boolean);
          const ra =
            typeof repA?.rank === "number" && repA.rank >= 1 ? repA.rank : 9999;
          const rb =
            typeof repB?.rank === "number" && repB.rank >= 1 ? repB.rank : 9999;
          return ra - rb;
        })
    : Array.from({ length: teams }, (_, i) => i + 1);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold text-zinc-800">{panelTitle}</h3>
        {isOngoing && !readOnly && (
          <p className="text-xs text-zinc-500">
            Edit kills per slot; set team rank once per team. Click Save to apply.
          </p>
        )}
      </div>

      {filledCount === 0 && !leaderboardMode ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
          No players registered yet — all slots are empty.
        </p>
      ) : isTeamMode ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teamNumbers.map((teamNumber) => (
            <TeamCard
              key={teamNumber}
              teamNumber={teamNumber}
              slotIndices={teamSlotIndices(teamNumber, matchType, maxParticipants)}
              slotMap={slotMap}
              matchType={matchType}
              readOnly={readOnly}
              isOngoing={isOngoing}
              leaderboardMode={leaderboardMode}
              localKills={localKills}
              setLocalKills={setLocalKills}
              localRank={localRank}
              setLocalRank={setLocalRank}
              updatingParticipant={updatingParticipant}
              onUpdateParticipant={onUpdateParticipant}
              getKills={getKills}
              prizePool={prizePool}
              teamCountForRank={teams}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sortedSoloSlots.map((slotIndex, i) => {
            const p = slotMap.get(slotIndex) ?? null;
            const killsArr = p ? getKills(p) : [0];
            const rankVal = p ? (localRank[p.id] ?? "") : "";
            const totalKills = killsArr[0] ?? 0;
            const position =
              p && typeof p.rank === "number" && p.rank >= 1
                ? p.rank
                : leaderboardMode
                  ? i + 1
                  : undefined;
            const coins =
              p && position != null
                ? calcCoinsForPosition(position, totalKills, prizePool)
                : undefined;

            return (
              <SlotBox
                key={slotIndex}
                slotIndex={slotIndex}
                participant={p}
                readOnly={readOnly}
                isOngoing={isOngoing}
                leaderboardMode={leaderboardMode}
                kills={totalKills}
                onKillsChange={
                  p
                    ? (v) =>
                        setLocalKills((prev) => ({
                          ...prev,
                          [p.id]: [v],
                        }))
                    : undefined
                }
                onUpdateKills={p ? () => onUpdateParticipant(p) : undefined}
                updating={p ? updatingParticipant === p.id : false}
                showRank
                rankVal={rankVal}
                onRankChange={
                  p
                    ? (v) =>
                        setLocalRank((prev) => ({
                          ...prev,
                          [p.id]: v,
                        }))
                    : undefined
                }
                onUpdateRank={p ? () => onUpdateParticipant(p) : undefined}
                rankUpdating={p ? updatingParticipant === p.id : false}
                coins={coins}
                position={position}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
