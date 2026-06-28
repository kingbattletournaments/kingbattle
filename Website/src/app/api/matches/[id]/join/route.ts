import { NextResponse } from "next/server";
import { invalidateAdminApiCache } from "@/lib/admin-api-cache";
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
    const holdId = body.holdId ?? body.hold_id;
    const slotPayload = body.slots ?? body.slot_bookings;

    if (holdId && Array.isArray(slotPayload) && slotPayload.length > 0) {
      const slots = slotPayload.map(
        (s: { slotIndex?: number; slot_index?: number; inGameName?: string; in_game_name?: string; inGameUid?: string; in_game_uid?: string }) => ({
          slotIndex: Number(s.slotIndex ?? s.slot_index),
          inGameName: String(s.inGameName ?? s.in_game_name ?? "").trim(),
          inGameUid: String(s.inGameUid ?? s.in_game_uid ?? "").trim(),
        }),
      );
      const store = getStore();
      const result = await store.joinMatch(
        matchId,
        userId,
        slots[0].inGameName,
        slots[0].inGameUid,
        undefined,
        { holdId: String(holdId), slots },
      );
      if (result?.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      invalidateAdminApiCache("public:matches:");
      return NextResponse.json({ success: true, slotsBooked: slots.length });
    }

    const inGameName = body.inGameName || body.in_game_name;
    const inGameUid = body.inGameUid || body.in_game_uid;
    const teamMembers = body.teamMembers || body.team_members;
    if (!inGameName || !inGameUid) {
      return NextResponse.json(
        { error: "Select slots first, or provide inGameName and inGameUid" },
        { status: 400 },
      );
    }
    const store = getStore();
    const result = await store.joinMatch(
      matchId,
      userId,
      String(inGameName).trim(),
      String(inGameUid).trim(),
      Array.isArray(teamMembers)
        ? teamMembers.slice(0, 3).map((t: { inGameName?: string; inGameUid?: string }) => ({
            inGameName: String(t?.inGameName ?? "").trim(),
            inGameUid: String(t?.inGameUid ?? "").trim(),
          }))
        : undefined,
    );
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    invalidateAdminApiCache("public:matches:");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
