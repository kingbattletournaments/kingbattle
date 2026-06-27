import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: matchId } = await params;
    const userId = await getAppUserId();
    const store = getStore();
    if (!store.getMatchSlotAvailability) {
      return NextResponse.json({ error: "Slots not available" }, { status: 503 });
    }
    const result = await store.getMatchSlotAvailability(matchId, userId ?? undefined);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to load slots" }, { status: 500 });
  }
}
