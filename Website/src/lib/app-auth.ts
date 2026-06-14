/**
 * App user session auth - signed cookie to prevent userId spoofing.
 * Use APP_SESSION_SECRET env var in production (min 32 chars).
 */

import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "app_user_session";
const MAX_AGE_DAYS = 30;

function getSecret(): string {
  const s = process.env.APP_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SESSION_SECRET must be set in production (min 32 chars)");
  }
  return "dev-secret-change-in-production-min-32-chars";
}

function sign(value: string): string {
  const secret = getSecret();
  const hmac = createHmac("sha256", secret);
  hmac.update(value);
  return hmac.digest("hex");
}

function verify(value: string, signature: string): boolean {
  const expected = sign(value);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export function createAppSessionCookie(userId: string): { name: string; value: string; options: object } {
  const payload = `${userId}.${Date.now()}`;
  const signature = sign(payload);
  const value = `${payload}.${signature}`;
  return {
    name: COOKIE_NAME,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * MAX_AGE_DAYS,
      path: "/",
    },
  };
}

import { getStore } from "./store";

export async function getAppUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  let raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) {
    const authHeader = (await headers()).get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      raw = authHeader.substring(7);
    }
  }

  if (raw) {
    const parts = raw.split(".");
    if (parts.length === 3) {
      const [userId, timestamp, signature] = parts;
      const payload = `${userId}.${timestamp}`;
      if (verify(payload, signature)) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age >= 0 && age <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
          return userId;
        }
      }
    }
  }

  // No authenticated session — do not impersonate users in production
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  // Development-only fallback for local testing without signing in
  try {
    const store = getStore();
    const allUsers = await store.users();
    if (allUsers.length > 0) {
      return allUsers[0].id;
    }
    // No users in database - register a default one
    const defaultUser = await store.addUser("test@kingbattle.com", "Test User", "password123");
    if (defaultUser) {
      return defaultUser.id;
    }
  } catch (error) {
    console.error("Auth bypass fallback error:", error);
  }

  return null;
}


export async function clearAppSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
