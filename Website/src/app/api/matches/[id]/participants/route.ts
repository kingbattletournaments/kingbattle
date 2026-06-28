import { unstable_noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

function matchHasPublicResults(status: string | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "completed" || s === "ended" || s === "finished";
}

function stripParticipantResults<T extends {
  rank?: number;
  teamMembers?: { inGameName: string; inGameUid: string; kills?: number }[];
}>(participants: T[]): T[] {
  return participants.map((p) => ({
    ...p,
    rank: undefined,
    teamMembers: (p.teamMembers ?? []).map((m) => ({
      ...m,
      kills: undefined,
    })),
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  unstable_noStore();
  const { id } = await params;
  const store = getStore();
  const match = await store.getMatch(id);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  let participants = match.participants ?? [];
  if (!matchHasPublicResults(match.status)) {
    participants = stripParticipantResults(participants);
  }
  return NextResponse.json(participants, { headers: NO_STORE });
}
