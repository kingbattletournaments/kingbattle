import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";
import { buildMatchScheduleTimes } from "@/lib/match-preset-schedule";
import { toScheduledAtIso } from "@/lib/app-timezone";
import { invalidateMatchListCaches } from "@/lib/admin-api-cache";
import { invalidateAdminDashboardStatsCache } from "@/lib/admin-dashboard-cache";

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

  const { presetId, gameModeId, matchDate, startingTime, gapMinutes, endingTime } = await request.json();

  if (!presetId || !gameModeId || !matchDate || !startingTime || !endingTime || gapMinutes == null) {
    return NextResponse.json(
      { error: "presetId, gameModeId, matchDate, startingTime, gapMinutes, and endingTime are required" },
      { status: 400 },
    );
  }

  const gap = Number(gapMinutes);
  if (!Number.isFinite(gap) || gap <= 0) {
    return NextResponse.json({ error: "gapMinutes must be a positive number" }, { status: 400 });
  }

  const preset = await store.getMatchPreset(presetId);
  if (!preset) return NextResponse.json({ error: "Preset not found" }, { status: 404 });

  const mode = await store.getMode(gameModeId);
  if (!mode) return NextResponse.json({ error: "Game mode not found" }, { status: 404 });

  if (admin.gamesAccessType === "specific" && !admin.isMasterAdmin && !admin.allowedGameIds.includes(mode.gameId)) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  const scheduleTimes = buildMatchScheduleTimes(matchDate, startingTime, gap, endingTime);
  if (scheduleTimes.length === 0) {
    return NextResponse.json(
      { error: "No valid match times in the given schedule. Check date, times, and gap." },
      { status: 400 },
    );
  }

  const scheduledAtList = scheduleTimes.map((d) => toScheduledAtIso(d));
  const matches = await store.createMatchesFromPreset(presetId, gameModeId, scheduledAtList);
  if (!matches || matches.length === 0) {
    return NextResponse.json({ error: "Failed to create matches" }, { status: 500 });
  }

  invalidateMatchListCaches();
  invalidateAdminDashboardStatsCache();
  return NextResponse.json({ count: matches.length, matches });
}
