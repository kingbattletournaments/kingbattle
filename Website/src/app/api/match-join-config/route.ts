import { NextResponse } from "next/server";
import { isInGameUidRequired } from "@/lib/match-join-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ requireInGameUid: isInGameUidRequired() });
}
