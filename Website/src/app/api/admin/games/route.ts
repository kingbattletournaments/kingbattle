import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_API_CACHE_TTL,
  getAdminApiCache,
  invalidateAdminApiCache,
  setAdminApiCache,
} from "@/lib/admin-api-cache";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const cacheKey = `games:${admin.id}`;
    const cached = getAdminApiCache<Awaited<ReturnType<ReturnType<typeof getStore>["games"]>>>(
      cacheKey,
      ADMIN_API_CACHE_TTL.games,
    );
    if (cached) return NextResponse.json(cached);

    const store = getStore();
    const games = await store.games(admin.id);
    setAdminApiCache(cacheKey, games);
    return NextResponse.json(games);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
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
    const { name, imageUrl } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const game = await store.addGame(name, imageUrl ?? null);
    if (!game) {
      return NextResponse.json({ error: "Failed to create game in database" }, { status: 500 });
    }
    invalidateAdminApiCache("games:");
    return NextResponse.json(game);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
