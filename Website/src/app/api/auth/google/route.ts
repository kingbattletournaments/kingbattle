import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSupabase } from "@/lib/supabase";
import { createAppSessionCookie } from "@/lib/app-auth";

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payloadJson);
  } catch (error) {
    console.error("Failed to decode JWT payload locally:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Google ID Token is required" }, { status: 400 });
    }

    let userId = "";
    let email = "";
    let displayName = "";
    let avatarUrl = "";

    const supabase = getSupabase();

    if (supabase) {
      // 1. Database is configured: Verify Google ID Token with Supabase Auth
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error || !data.user) {
        console.error("Supabase signInWithIdToken verification error:", error);
        return NextResponse.json({ error: error?.message || "Invalid Google ID Token" }, { status: 401 });
      }

      const user = data.user;
      userId = user.id;
      email = user.email || "";
      displayName = user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0];
      avatarUrl = user.user_metadata?.avatar_url || "";
    } else {
      // 2. Database is NOT configured: Decode ID Token locally (mock flow for testing)
      const payload = decodeJwtPayload(idToken);
      if (!payload) {
        return NextResponse.json({ error: "Invalid ID Token format" }, { status: 400 });
      }

      email = payload.email || "";
      displayName = payload.name || payload.given_name || email.split("@")[0];
      avatarUrl = payload.picture || "";
      // Generate a mock stable UUID based on email hash or use sub
      userId = payload.sub || "mock-user-12345";
    }

    // 3. Synchronize user profile into app_users table
    const store = getStore();
    const syncedUser = await store.syncGoogleUser(userId, email, displayName, avatarUrl);

    if (!syncedUser) {
      return NextResponse.json({ error: "Failed to synchronize user account" }, { status: 500 });
    }

    if (syncedUser.isBlocked) {
      return NextResponse.json({ error: "This account has been blocked" }, { status: 403 });
    }

    // 4. Generate App session token cookie
    const { name, value, options } = createAppSessionCookie(syncedUser.id);
    const res = NextResponse.json({
      user: {
        id: syncedUser.id,
        email: syncedUser.email,
        display_name: syncedUser.displayName,
        coins: syncedUser.coins,
        is_blocked: syncedUser.isBlocked ?? false,
        avatar_url: syncedUser.avatarUrl || null,
        created_at: syncedUser.createdAt || null,
        username: syncedUser.username || null
      },
      session: {
        access_token: value,
        refresh_token: null,
        expires_in: 60 * 60 * 24 * 30, // 30 days
        token_type: "Bearer"
      }
    });

    res.cookies.set(name, value, options);
    return res;

  } catch (error: any) {
    console.error("Google Auth API route exception:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
