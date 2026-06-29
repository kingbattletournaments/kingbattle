import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { invalidateAdminApiCache } from "@/lib/admin-api-cache";
import { normalizeAdminUser, serializeAdminUser } from "@/lib/admin-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  const { id } = await params;
  const user = await getStore().getUser(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(serializeAdminUser(normalizeAdminUser(user)));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess) return NextResponse.json({ error: "No users access" }, { status: 403 });
  const { id } = await params;
  const ok = await getStore().deleteUser(id);
  if (!ok) return NextResponse.json({ error: "User not found" }, { status: 404 });
  invalidateAdminApiCache("users");
  return NextResponse.json({ success: true });
}
