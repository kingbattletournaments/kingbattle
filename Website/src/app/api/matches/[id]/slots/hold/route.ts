import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAppUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: matchId } = await params;
    const body = await request.json();
    const slotIndices = (body.slotIndices ?? body.slot_indices ?? []) as number[];
    if (!Array.isArray(slotIndices) || slotIndices.length === 0) {
      return NextResponse.json({ error: "slotIndices required" }, { status: 400 });
    }

    const store = getStore();
    if (!store.holdMatchSlots) {
      return NextResponse.json({ error: "Slots not available" }, { status: 503 });
    }
    const result = await store.holdMatchSlots(matchId, userId, slotIndices.map(Number));
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ holdId: result.holdId, expiresInSeconds: 300 });
  } catch {
    return NextResponse.json({ error: "Failed to hold slots" }, { status: 400 });
  }
}
