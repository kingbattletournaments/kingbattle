import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { invalidateAdminApiCache } from "@/lib/admin-api-cache";
import { normalizeAdminUser, serializeAdminUser } from "@/lib/admin-user";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess) return NextResponse.json({ error: "No users access" }, { status: 403 });
  const { id } = await params;
  const store = getStore();
  const ok = await store.unblockUser(id);
  if (!ok) return NextResponse.json({ error: "User not found or unblock failed" }, { status: 404 });
  invalidateAdminApiCache("users");
  const user = await store.getUser(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(serializeAdminUser(normalizeAdminUser(user)));
}
