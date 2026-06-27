import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import {
  getAdminApiCache,
  setAdminApiCache,
} from "@/lib/admin-api-cache";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 30 * 1000;
const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modeId = searchParams.get("modeId") || searchParams.get("mode_id");
  if (!modeId) {
    return NextResponse.json({ error: "modeId required" }, { status: 400 });
  }

  const cacheKey = `public:matches:${modeId}`;
  const cached = getAdminApiCache<unknown>(cacheKey, CACHE_TTL_MS);
  if (cached) return NextResponse.json(cached, { headers: CACHE_HEADERS });

  const store = getStore();
  const matches = await store.matches(modeId);
  const withStartsAt = matches.map((m) => ({ ...m, startsAt: m.scheduledAt }));
  setAdminApiCache(cacheKey, withStartsAt);
  return NextResponse.json(withStartsAt, { headers: CACHE_HEADERS });
}
