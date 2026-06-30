import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";
import { toScheduledAtIso } from "@/lib/app-timezone";
import { validateMaxParticipants, normalizeMaxParticipants } from "@/lib/match-slots";
import { invalidateAdminDashboardStatsCache } from "@/lib/admin-dashboard-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const { searchParams } = new URL(request.url);
  const modeId = searchParams.get("modeId");
  const store = getStore();
  if (modeId && admin.gamesAccessType === "specific" && !admin.isMasterAdmin) {
    const mode = await store.getMode(modeId);
    if (mode && !admin.allowedGameIds.includes(mode.gameId)) {
      return NextResponse.json({ error: "No access to this mode" }, { status: 403, headers: NO_STORE });
    }
  }
  const matches = await store.matches(modeId ?? undefined);
  return NextResponse.json(matches, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = getStore();
  if (!(await store.canAccessGames(admin.id))) {
    return NextResponse.json({ error: "No games access" }, { status: 403 });
  }
  const { gameModeId, title, entryFee, maxParticipants, scheduledAt, matchType, prizePool, image } =
    await request.json();
  if (!gameModeId || !title || entryFee == null) {
    return NextResponse.json(
      { error: "gameModeId, title, and entryFee are required" },
      { status: 400 }
    );
  }
  const validMatchType = ["solo", "duo", "squad"].includes(matchType) ? matchType : "solo";
  const rawMax = Number(maxParticipants) || 16;
  const maxErr = validateMaxParticipants(validMatchType, rawMax);
  if (maxErr) {
    return NextResponse.json({ error: maxErr }, { status: 400 });
  }
  const validMaxParticipants = normalizeMaxParticipants(validMatchType, rawMax);
  const validPrizePool = prizePool && typeof prizePool.coinsPerKill === "number" && Array.isArray(prizePool.rankRewards)
    ? {
        coinsPerKill: Number(prizePool.coinsPerKill),
        totalPrizePool: prizePool.totalPrizePool != null ? Number(prizePool.totalPrizePool) : 0,
        rankRewards: (prizePool.rankRewards as { fromRank: number; toRank: number; coins: number }[])
          .filter((r) => r && typeof r.fromRank === "number" && typeof r.toRank === "number" && typeof r.coins === "number")
          .map((r) => ({ fromRank: r.fromRank, toRank: r.toRank, coins: r.coins })),
      }
    : {
        coinsPerKill: 5,
        totalPrizePool: 0,
        rankRewards: [
          { fromRank: 1, toRank: 1, coins: 0 },
          { fromRank: 2, toRank: 2, coins: 0 },
          { fromRank: 3, toRank: 3, coins: 0 },
        ],
      };
  const mode = await store.getMode(gameModeId);
  if (mode && admin.gamesAccessType === "specific" && !admin.isMasterAdmin && !admin.allowedGameIds.includes(mode.gameId)) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }
  const match = await store.addMatch(
    gameModeId,
    title,
    Number(entryFee),
    validMaxParticipants,
    toScheduledAtIso(scheduledAt),
    validMatchType,
    validPrizePool,
    "BERMUDA",
    image
  );
  if (!match) return NextResponse.json({ error: "Failed to create match" }, { status: 500 });
  invalidateAdminDashboardStatsCache();
  return NextResponse.json(match, { headers: NO_STORE });
}
