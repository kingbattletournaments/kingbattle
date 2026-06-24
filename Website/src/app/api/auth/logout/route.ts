import { NextResponse } from "next/server";
import { clearAppSession, getAppUserId } from "@/lib/app-auth";
import { getStore } from "@/lib/store";

export async function POST() {
  const userId = await getAppUserId();
  if (userId) {
    await getStore().clearFcmToken(userId);
  }
  await clearAppSession();
  return NextResponse.json({ ok: true });
}
