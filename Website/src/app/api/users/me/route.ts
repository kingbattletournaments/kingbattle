import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";

export async function GET() {
  const userId = await getAppUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = getStore();
  const user = await store.getUser(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    coins: user.coins,
    wonCoins: user.wonCoins ?? 0,
    won_coins: user.wonCoins ?? 0,
    isBlocked: user.isBlocked,
    lifetimeEarnedPoints: user.lifetimeEarnedPoints ?? 0,
    matchesPlayed: user.matchesPlayed ?? 0,
    totalKills: user.totalKills ?? 0,
    username: user.username,
  });
}
