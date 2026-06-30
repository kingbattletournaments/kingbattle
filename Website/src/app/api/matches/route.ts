import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";
import { parseMatchListParams } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modeId = searchParams.get("modeId") || searchParams.get("mode_id");
  if (!modeId) {
    return NextResponse.json({ error: "modeId required" }, { status: 400, headers: NO_STORE });
  }

  const { page, pageSize, status } = parseMatchListParams(searchParams);
  const store = getStore();

  const result =
    modeId === "my_matches"
      ? await (async () => {
          const userId = await getAppUserId();
          if (!userId) {
            return { items: [], page, pageSize, total: 0, totalPages: 1, hasMore: false };
          }
          return store.matchesPaginatedForUser({ userId, page, pageSize, status });
        })()
      : await store.matchesPaginated({ modeId, page, pageSize, status });

  const items = result.items.map((m) => ({ ...m, startsAt: m.scheduledAt }));
  return NextResponse.json({ ...result, items }, { headers: NO_STORE });
}
