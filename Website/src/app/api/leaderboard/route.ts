import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Global cache to persist leaderboard data and last update timestamp
const globalForCache = globalThis as unknown as {
  leaderboardCache?: Array<{ id: string; displayName: string; coins: number }>;
  leaderboardCacheTime?: number;
};

export async function GET() {
  try {
    const now = Date.now();
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (
      globalForCache.leaderboardCache &&
      globalForCache.leaderboardCacheTime &&
      now - globalForCache.leaderboardCacheTime < CACHE_DURATION
    ) {
      return NextResponse.json(globalForCache.leaderboardCache);
    }

    const store = getStore();
    const allUsers = await store.users();
    // Sort users by lifetimeEarnedPoints (with fallback to coins) descending and limit to top 10
    const sorted = [...allUsers]
      .sort((a, b) => {
        const scoreA = a.lifetimeEarnedPoints ?? a.coins ?? 0;
        const scoreB = b.lifetimeEarnedPoints ?? b.coins ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map((u) => ({
        id: u.id,
        displayName: u.displayName,
        coins: u.lifetimeEarnedPoints ?? u.coins ?? 0,
      }));

    // Save to global cache
    globalForCache.leaderboardCache = sorted;
    globalForCache.leaderboardCacheTime = now;

    return NextResponse.json(sorted);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
