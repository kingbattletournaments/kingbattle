import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";

export async function POST(request: Request) {
  try {
    const userId = await getAppUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fcmToken } = body;

    if (!fcmToken || typeof fcmToken !== "string") {
      return NextResponse.json({ error: "fcmToken required" }, { status: 400 });
    }

    const success = await getStore().updateFcmToken(userId, fcmToken);
    if (!success) {
      return NextResponse.json({ error: "Failed to update FCM token" }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
