import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { cookies } from "next/headers";
import { adminClientPayload } from "@/lib/admin-tabs";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: Request) {
  const { adminname, password } = await request.json();
  if (!adminname || !password) {
    return NextResponse.json({ error: "Admin name and password required" }, { status: 400 });
  }
  const admin = await getStore().loginAdmin(adminname, password);
  if (!admin) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, admin.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return NextResponse.json(adminClientPayload(admin));
}
