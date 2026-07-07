import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { invalidateMatchListCaches } from "@/lib/admin-api-cache";
import { invalidateAdminDashboardStatsCache } from "@/lib/admin-dashboard-cache";
import {
  normalizeManualEntryOptions,
  type ScoringMode,
} from "@/lib/match-scoring";

async function checkMatchAccess(adminId: string, matchId: string): Promise<boolean> {
  const store = getStore();
  const [admin, match] = await Promise.all([store.getAdminById(adminId), store.getMatch(matchId)]);
  if (!admin || !match) return false;
  const mode = await store.getMode(match.gameModeId);
  if (!mode) return false;
  if (admin.isMasterAdmin || admin.gamesAccessType === "all") return true;
  return admin.allowedGameIds.includes(mode.gameId);
}

export async function PATCH(
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
  const scoringMode =
    body.scoringMode === "kills_only" ||
    body.scoringMode === "rank_only" ||
    body.scoringMode === "rank_kills" ||
    body.scoringMode === "manual"
      ? (body.scoringMode as ScoringMode)
      : undefined;
  if (!scoringMode) {
    return NextResponse.json({ error: "Invalid scoring mode" }, { status: 400 });
  }

  const manualEntryOptions =
    body.manualEntryOptions != null
      ? normalizeManualEntryOptions(body.manualEntryOptions)
      : undefined;

  const store = getStore();
  const updated = await store.updateMatchScoringConfig(id, scoringMode, manualEntryOptions);
  if (!updated) {
    return NextResponse.json({ error: "Unable to update scoring mode" }, { status: 400 });
  }
  invalidateMatchListCaches();
  invalidateAdminDashboardStatsCache();
  const full = await store.getMatch(id);
  return NextResponse.json(full ?? updated);
}
