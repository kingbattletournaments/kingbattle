import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";
import { normalizeAdminUser, serializeAdminUser } from "@/lib/admin-user";

export async function GET() {
  const userId = await getAppUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = getStore();
  const user = await store.getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const normalized = normalizeAdminUser({
    ...user,
    lifetimeEarnedPoints: user.lifetimeEarnedPoints ?? 0,
    matchesPlayed: user.matchesPlayed ?? 0,
    totalKills: user.totalKills ?? 0,
  });

  return NextResponse.json(
    {
      ...serializeAdminUser(normalized),
      lifetimeEarnedPoints: user.lifetimeEarnedPoints ?? 0,
      matchesPlayed: user.matchesPlayed ?? 0,
      totalKills: user.totalKills ?? 0,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
