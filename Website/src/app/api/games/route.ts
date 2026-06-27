import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import {
  getAdminApiCache,
  setAdminApiCache,
} from "@/lib/admin-api-cache";

/** Always read from DB — do not freeze the list at build time */
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 1000;
const CACHE_HEADERS = {
  "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
} as const;

export async function GET() {
  const cached = getAdminApiCache<unknown>("public:games", CACHE_TTL_MS);
  if (cached) return NextResponse.json(cached, { headers: CACHE_HEADERS });

  const store = getStore();
  const games = await store.games();
  setAdminApiCache("public:games", games);
  return NextResponse.json(games, { headers: CACHE_HEADERS });
}
