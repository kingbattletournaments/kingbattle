import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "modeId required" }, { status: 400 });
  }

  const store = getStore();
  const matches = await store.matches(modeId);
  const withStartsAt = matches.map((m) => ({ ...m, startsAt: m.scheduledAt }));
  return NextResponse.json(withStartsAt, { headers: NO_STORE });
}
