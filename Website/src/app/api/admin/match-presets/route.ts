import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";

function normalizePrizePool(prizePool: unknown) {
  if (
    prizePool &&
    typeof prizePool === "object" &&
    typeof (prizePool as { coinsPerKill?: unknown }).coinsPerKill === "number" &&
    Array.isArray((prizePool as { rankRewards?: unknown }).rankRewards)
  ) {
    const p = prizePool as {
      coinsPerKill: number;
      totalPrizePool?: number;
      rankRewards: { fromRank: number; toRank: number; coins: number }[];
    };
    return {
      coinsPerKill: Number(p.coinsPerKill),
      totalPrizePool: p.totalPrizePool != null ? Number(p.totalPrizePool) : 0,
      rankRewards: p.rankRewards
        .filter((r) => r && typeof r.fromRank === "number" && typeof r.toRank === "number" && typeof r.coins === "number")
        .map((r) => ({ fromRank: r.fromRank, toRank: r.toRank, coins: r.coins })),
    };
  }
  return {
    coinsPerKill: 5,
    totalPrizePool: 0,
    rankRewards: [
      { fromRank: 1, toRank: 1, coins: 0 },
      { fromRank: 2, toRank: 2, coins: 0 },
      { fromRank: 3, toRank: 3, coins: 0 },
    ],
  };
}

async function assertGamesAccess(admin: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>, gameModeId?: string) {
  const store = getStore();
  if (!(await store.canAccessGames(admin.id))) {
    return NextResponse.json({ error: "No games access" }, { status: 403 });
  }
  if (gameModeId && admin.gamesAccessType === "specific" && !admin.isMasterAdmin) {
    const mode = await store.getMode(gameModeId);
    if (mode && !admin.allowedGameIds.includes(mode.gameId)) {
      return NextResponse.json({ error: "No access to this game" }, { status: 403 });
    }
  }
  return null;
}

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const modeId = searchParams.get("modeId") ?? undefined;
  const accessError = await assertGamesAccess(admin, modeId ?? undefined);
  if (accessError) return accessError;
  const store = getStore();
  const presets = await store.matchPresets(modeId);
  return NextResponse.json(presets);
}

export async function POST(request: Request) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    gameModeId,
    name,
    title,
    entryFee,
    maxParticipants,
    matchType,
    map,
    prizePool,
    image,
  } = body;

  if (!gameModeId || !name || !title || entryFee == null) {
    return NextResponse.json(
      { error: "gameModeId, name, title, and entryFee are required" },
      { status: 400 },
    );
  }

  const accessError = await assertGamesAccess(admin, gameModeId);
  if (accessError) return accessError;

  const validMatchType = ["solo", "duo", "squad"].includes(matchType) ? matchType : "solo";
  const store = getStore();
  const preset = await store.addMatchPreset({
    gameModeId,
    name: String(name),
    title: String(title),
    entryFee: Number(entryFee),
    maxParticipants: Number(maxParticipants) || 16,
    matchType: validMatchType,
    map: map || "BERMUDA",
    prizePool: normalizePrizePool(prizePool),
    image: image ?? null,
  });

  if (!preset) return NextResponse.json({ error: "Failed to create preset" }, { status: 500 });
  return NextResponse.json(preset);
}
