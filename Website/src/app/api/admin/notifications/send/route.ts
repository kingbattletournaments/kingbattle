import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getFirebaseConfigError, sendPushToTokens, type PushTarget } from "@/lib/fcm";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";

export async function POST(request: Request) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }

  const firebaseError = getFirebaseConfigError();
  if (firebaseError) {
    return NextResponse.json({ error: firebaseError }, { status: 503 });
  }

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!admin.isMasterAdmin && !admin.usersAccess) {
    return NextResponse.json({ error: "No access to send notifications" }, { status: 403 });
  }

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";
  const link = typeof body.link === "string" ? body.link.trim() : "";
  const target = (["all", "active", "blocked"] as const).includes(body.target)
    ? (body.target as PushTarget)
    : "all";

  if (!title || !messageBody) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const store = getStore();
  const tokenRows = await store.getFcmTokensForTarget(target);
  const tokens = tokenRows.map((row) => row.token);
  const targetedUsers = tokenRows.map((row) => ({
    userId: row.userId,
    tokenSuffix: row.token.slice(-8),
  }));

  if (tokens.length === 0) {
    return NextResponse.json(
      { error: "No registered devices found for this audience. Users must open the app while logged in." },
      { status: 400 },
    );
  }

  try {
    const result = await sendPushToTokens(tokens, title, messageBody, link || null, targetedUsers);

    if (result.invalidTokens?.length) {
      await Promise.all(result.invalidTokens.map((token) => store.clearFcmTokenByValue(token)));
    }

    return NextResponse.json({
      ok: true,
      target,
      ...result,
    });
  } catch (error) {
    console.error("FCM send failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send notifications" },
      { status: 500 },
    );
  }
}
