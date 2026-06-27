import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import {
  getAdminApiCache,
  setAdminApiCache,
} from "@/lib/admin-api-cache";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modeId = searchParams.get("modeId");
  if (modeId) {
    const store = getStore();
    const mode = await store.getMode(modeId);
    if (!mode) return NextResponse.json({ error: "Mode not found" }, { status: 404 });
    return NextResponse.json(mode, { headers: CACHE_HEADERS });
  }
  const gameId = searchParams.get("gameId") ?? searchParams.get("game_id");
  const cacheKey = `public:modes:${gameId ?? "all"}`;
  const cached = getAdminApiCache<unknown>(cacheKey, CACHE_TTL_MS);
  if (cached) return NextResponse.json(cached, { headers: CACHE_HEADERS });

  const store = getStore();
  const modes = await store.gameModes(gameId || undefined);
  setAdminApiCache(cacheKey, modes);
  return NextResponse.json(modes, { headers: CACHE_HEADERS });
}
