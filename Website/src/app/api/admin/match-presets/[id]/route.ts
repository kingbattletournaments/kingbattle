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
  return undefined;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const existing = await store.getMatchPreset(id);
  if (!existing) return NextResponse.json({ error: "Preset not found" }, { status: 404 });

  if (!(await store.canAccessGames(admin.id))) {
    return NextResponse.json({ error: "No games access" }, { status: 403 });
  }
  if (admin.gamesAccessType === "specific" && !admin.isMasterAdmin) {
    const mode = await store.getMode(existing.gameModeId);
    if (mode && !admin.allowedGameIds.includes(mode.gameId)) {
      return NextResponse.json({ error: "No access to this game" }, { status: 403 });
    }
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name != null) updates.name = String(body.name);
  if (body.title != null) updates.title = String(body.title);
  if (body.entryFee != null) updates.entryFee = Number(body.entryFee);
  if (body.maxParticipants != null) updates.maxParticipants = Number(body.maxParticipants);
  if (body.matchType != null && ["solo", "duo", "squad"].includes(body.matchType)) {
    updates.matchType = body.matchType;
  }
  if (body.map != null) updates.map = String(body.map);
  if (body.image !== undefined) updates.image = body.image;
  const prizePool = normalizePrizePool(body.prizePool);
  if (prizePool) updates.prizePool = prizePool;

  const preset = await store.updateMatchPreset(id, updates);
  if (!preset) return NextResponse.json({ error: "Failed to update preset" }, { status: 500 });
  return NextResponse.json(preset);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = getStore();
  const existing = await store.getMatchPreset(id);
  if (!existing) return NextResponse.json({ error: "Preset not found" }, { status: 404 });

  if (!(await store.canAccessGames(admin.id))) {
    return NextResponse.json({ error: "No games access" }, { status: 403 });
  }
  if (admin.gamesAccessType === "specific" && !admin.isMasterAdmin) {
    const mode = await store.getMode(existing.gameModeId);
    if (mode && !admin.allowedGameIds.includes(mode.gameId)) {
      return NextResponse.json({ error: "No access to this game" }, { status: 403 });
    }
  }

  const ok = await store.deleteMatchPreset(id);
  if (!ok) return NextResponse.json({ error: "Failed to delete preset" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
