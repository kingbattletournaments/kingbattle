"use client";

import { useState } from "react";
import { formatMatchDateTime } from "@/lib/format-match-datetime";

export type MatchType = "solo" | "duo" | "squad";
export type RankReward = { fromRank: number; toRank: number; coins: number };
export type PrizePool = { coinsPerKill: number; totalPrizePool?: number; rankRewards: RankReward[] };

export type AdminMatchCardItem = {
  id: string;
  title: string;
  entryFee: number;
  maxParticipants: number;
  matchType?: MatchType;
  prizePool?: PrizePool;
  image?: string | null;
  map?: string;
  scheduledAt?: string;
  participantCount?: number;
  /** Primary line under title (e.g. start time or preset name). */
  infoLine?: string;
  /** Secondary line (e.g. game / mode). */
  metaLine?: string;
};

export function getAdminMatchBanner(item: { image?: string | null; title: string; matchType?: string }) {
  if (item.image) {
    if (item.image.startsWith("http") || item.image.startsWith("/")) {
      return item.image;
    }
    if (item.image.includes("poster_1") || item.image.includes("poster1")) return "/images/ff_image.jpg";
    if (item.image.includes("poster_2") || item.image.includes("poster2")) return "/images/bgmi_image.jpg";
    if (item.image.includes("poster_3") || item.image.includes("poster3")) return "/images/cod_image.jpg";
  }
  const t = item.title.toLowerCase();
  if (t.includes("duo")) return "/images/bgmi_image.jpg";
  if (t.includes("squad")) return "/images/cod_image.jpg";
  return "/images/ff_image.jpg";
}

type AdminMatchCardProps = {
  item: AdminMatchCardItem;
  isSelected?: boolean;
  selectionMode?: boolean;
  canSelect?: boolean;
  onCardClick?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onManage?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  manageLabel?: string;
  showProgress?: boolean;
};

export function AdminMatchCard({
  item,
  isSelected = false,
  selectionMode = false,
  canSelect = false,
  onCardClick,
  onLongPressStart,
  onLongPressEnd,
  onContextMenu,
  onManage,
  onEdit,
  onDelete,
  manageLabel = "Manage Match",
  showProgress = true,
}: AdminMatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const spotsTaken = item.participantCount ?? 0;
  const maxParticipants = item.maxParticipants ?? 100;
  const spotsLeft = Math.max(0, maxParticipants - spotsTaken);
  const infoLine =
    item.infoLine ??
    (item.scheduledAt ? `Starts: ${formatMatchDateTime(item.scheduledAt)}` : undefined);

  return (
    <div
      className={`admin-content-card relative rounded-2xl overflow-hidden transition flex flex-col cursor-pointer ${
        isSelected ? "ring-2 ring-zinc-900 border-zinc-400" : "hover:border-zinc-300"
      }`}
      onClick={onCardClick}
      onContextMenu={onContextMenu}
      onMouseDown={onLongPressStart}
      onMouseUp={onLongPressEnd}
      onMouseLeave={onLongPressEnd}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-bold shadow-lg">
          ✓
        </div>
      )}

      <div className="relative aspect-[16/9] w-full bg-zinc-100 overflow-hidden">
        <img
          src={getAdminMatchBanner(item)}
          alt="Match Banner"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex items-center gap-3 p-4 border-b border-zinc-200/60">
        <img
          src="/images/app-icon.png"
          alt="Logo"
          className="w-10 h-10 object-cover rounded-lg border border-zinc-200 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-zinc-900 text-sm truncate" title={item.title}>
            {item.title}
          </h4>
          {infoLine && (
            <p className="text-xs text-zinc-500 font-medium mt-0.5">{infoLine}</p>
          )}
          {item.metaLine && (
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{item.metaLine}</p>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-3 gap-y-4 gap-x-2 text-center border-b border-zinc-200/60 bg-white/10">
        <div
          className="cursor-pointer select-none"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Prize Pool</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="text-xs">💵</span>
            <span className="text-xs font-bold text-zinc-900">{item.prizePool?.totalPrizePool ?? 0}</span>
            <span className="text-[10px] text-zinc-500">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Per Kill</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="text-xs">💵</span>
            <span className="text-xs font-bold text-zinc-900">{item.prizePool?.coinsPerKill ?? 0}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Entry Fee</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="text-xs">💵</span>
            <span className="text-xs font-bold text-zinc-900">{item.entryFee}</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Type</p>
          <p className="text-xs font-bold text-zinc-600 mt-1 capitalize">{item.matchType ?? "Solo"}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Max</p>
          <p className="text-xs font-bold text-zinc-600 mt-1">{maxParticipants}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Map</p>
          <p className="text-xs font-bold text-zinc-600 mt-1 uppercase truncate">{item.map ?? "BERMUDA"}</p>
        </div>
      </div>

      {expanded && (
        <div className="p-4 bg-zinc-100/40 border-b border-zinc-200/60 text-xs">
          <p className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider mb-2">Rank Rewards</p>
          {!item.prizePool?.rankRewards || item.prizePool.rankRewards.length === 0 ? (
            <p className="text-zinc-500 text-xs">All prizes distributed via per-kill earnings.</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {item.prizePool.rankRewards.map((reward, ri) => (
                <div
                  key={ri}
                  className="flex justify-between items-center text-zinc-600 py-0.5 border-b border-zinc-200 last:border-0"
                >
                  <span>
                    Rank{" "}
                    {reward.fromRank === reward.toRank
                      ? reward.fromRank
                      : `${reward.fromRank} - ${reward.toRank}`}
                  </span>
                  <span className="font-semibold text-zinc-900">💵 {reward.coins} coins</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col justify-end space-y-3 bg-white/5">
        {showProgress && (
          <div>
            <div className="flex justify-between items-center text-xs text-zinc-500 mb-1">
              <span>
                Joined: {spotsTaken} / {maxParticipants}
              </span>
              <span>{spotsLeft} spots left</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-50 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-900 transition-all"
                style={{ width: `${Math.min(100, (spotsTaken / maxParticipants) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {selectionMode && canSelect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCardClick?.();
            }}
            className={`w-full rounded-xl py-2.5 text-xs font-semibold transition ${
              isSelected
                ? "bg-zinc-100 text-zinc-800 border border-zinc-300"
                : "bg-zinc-50 text-zinc-600 border border-zinc-200"
            }`}
          >
            {isSelected ? "Selected" : "Select"}
          </button>
        ) : (
          <div className="space-y-2">
            {onManage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManage();
                }}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl py-2.5 text-xs font-semibold transition"
              >
                {manageLabel}
              </button>
            )}
            {(onEdit || onDelete) && (
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="flex-1 rounded-xl border border-zinc-300 bg-white py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-semibold text-white transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
