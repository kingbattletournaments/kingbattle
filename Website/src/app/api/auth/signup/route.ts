import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { createAppSessionCookie } from "@/lib/app-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, displayName, display_name, password, username, referredBy, referred_by } = body;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password required (min 6 characters)" }, { status: 400 });
    }
    const name = typeof displayName === "string" && displayName.trim()
      ? displayName.trim()
      : typeof display_name === "string" && display_name.trim()
      ? display_name.trim()
      : email.substring(0, email.indexOf("@")) || "User";
    const user = await getStore().addUser(email.trim(), name, password, username, referredBy || referred_by);
    if (!user) {
      return NextResponse.json({ error: "Email already registered or username already exists" }, { status: 409 });
    }
    const { name: cookieName, value, options } = createAppSessionCookie(user.id);
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        coins: user.coins,
        wonCoins: user.wonCoins ?? 0,
        won_coins: user.wonCoins ?? 0,
        is_blocked: user.isBlocked ?? false,
        username: user.username,
      },
      session: {
        access_token: value,
        refresh_token: null,
        expires_in: 60 * 60 * 24 * 30, // 30 days
        token_type: "Bearer"
      }
    });
    res.cookies.set(cookieName, value, options);
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
