import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isUsingSupabase } from "@/lib/store-config";
import { cookies } from "next/headers";
import { adminClientPayload } from "@/lib/admin-tabs";

const SESSION_COOKIE = "admin_session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ admin: null }, { status: 200 });
  }
  const admin = await getStore().getAdminById(sessionId);
  if (!admin) {
    return NextResponse.json({ admin: null }, { status: 200 });
  }
  return NextResponse.json({
    admin: adminClientPayload(admin),
    databaseConfigured: isUsingSupabase(),
  });
}
