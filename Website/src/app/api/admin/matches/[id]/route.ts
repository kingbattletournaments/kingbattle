import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { toScheduledAtIso } from "@/lib/app-timezone";
import { validateMaxParticipants } from "@/lib/match-slots";

async function checkMatchAccess(adminId: string, matchId: string): Promise<boolean> {
  const store = getStore();
  const [admin, match] = await Promise.all([store.getAdminById(adminId), store.getMatch(matchId)]);
  if (!admin || !match) return false;
  const mode = await store.getMode(match.gameModeId);
  if (!mode) return false;
  if (admin.isMasterAdmin || admin.gamesAccessType === "all") return true;
  return admin.allowedGameIds.includes(mode.gameId);
}

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await checkMatchAccess(admin.id, id))) {
    return NextResponse.json({ error: "No access to this match" }, { status: 403 });
  }
  const store = getStore();
  const match = await store.getMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json(match);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await checkMatchAccess(admin.id, id))) {
    return NextResponse.json({ error: "No access to this match" }, { status: 403 });
  }
  const store = getStore();
  const ok = await store.deleteMatch(id);
  if (!ok) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await checkMatchAccess(admin.id, id))) {
    return NextResponse.json({ error: "No access to this match" }, { status: 403 });
  }
  const body = await request.json();
  const store = getStore();
  const match = await store.getMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  if (match.status === "upcoming") {
    const updates: Record<string, unknown> = {};
    if (body.title != null && typeof body.title === "string") updates.title = body.title;
    if (body.entryFee != null) updates.entryFee = Number(body.entryFee);
    if (body.maxParticipants != null) {
      const nextType = (body.matchType ?? match.matchType) as string;
      const nextMax = Number(body.maxParticipants);
      const maxErr = validateMaxParticipants(nextType, nextMax);
      if (maxErr) return NextResponse.json({ error: maxErr }, { status: 400 });
      updates.maxParticipants = nextMax;
    }
    if (body.scheduledAt != null) updates.scheduledAt = toScheduledAtIso(body.scheduledAt);
    if (body.matchType != null && ["solo", "duo", "squad"].includes(body.matchType)) {
      updates.matchType = body.matchType;
    }
    if (body.map != null) updates.map = String(body.map);
    if (body.image !== undefined) updates.image = body.image;
    const prizePool = normalizePrizePool(body.prizePool);
    if (prizePool) updates.prizePool = prizePool;

    if (Object.keys(updates).length > 0) {
      const updated = await store.updateMatch(id, updates as Parameters<typeof store.updateMatch>[1]);
      if (updated) {
        const full = await store.getMatch(id);
        return NextResponse.json(full!);
      }
    }
  }

  if (body.title != null && typeof body.title === "string") {
    await store.renameMatch(id, body.title);
  }
  if (match.status === "upcoming" && body.roomCode != null && body.roomPassword != null) {
    const updated = await store.updateMatchRoomInfo(id, String(body.roomCode), String(body.roomPassword));
    if (updated) {
      const full = await store.getMatch(id);
      return NextResponse.json(full!);
    }
  }
  const updated = await store.getMatch(id);
  return NextResponse.json(updated!);
}
