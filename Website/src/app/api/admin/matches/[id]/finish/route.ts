import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";

async function checkMatchAccess(adminId: string, matchId: string): Promise<boolean> {
  const store = getStore();
  const [admin, match] = await Promise.all([store.getAdminById(adminId), store.getMatch(matchId)]);
  if (!admin || !match) return false;
  const mode = await store.getMode(match.gameModeId);
  if (!mode) return false;
  if (admin.isMasterAdmin || admin.gamesAccessType === "all") return true;
  return admin.allowedGameIds.includes(mode.gameId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await checkMatchAccess(admin.id, id))) {
    return NextResponse.json({ error: "No access to this match" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const participantUpdates = Array.isArray(body.participants)
    ? (body.participants as { id?: string; kills?: number[]; rank?: number }[])
        .filter((p) => p?.id)
        .map((p) => ({
          id: String(p.id),
          kills: Array.isArray(p.kills) ? p.kills.map((k) => Number(k) || 0) : undefined,
          rank: typeof p.rank === "number" && p.rank >= 1 ? p.rank : undefined,
        }))
    : undefined;

  const store = getStore();
  const match = await store.finishMatch(id, participantUpdates);
  if (!match) {
    return NextResponse.json(
      { error: "Match not found or not ongoing" },
      { status: 400 },
    );
  }
  const full = await store.getMatch(id);
  return NextResponse.json(full ?? match);
}
