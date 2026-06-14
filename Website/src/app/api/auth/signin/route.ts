import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { createAppSessionCookie } from "@/lib/app-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email or username required" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }
    const user = await getStore().signInUser(email.trim(), password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const { name, value, options } = createAppSessionCookie(user.id);
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
    res.cookies.set(name, value, options);
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
