import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { buildUserTransactionFeed } from "@/lib/user-transaction-feed";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }
  const { id } = await params;
  const store = getStore();
  const user = await store.getUser(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const items = await buildUserTransactionFeed(store, id);
  return NextResponse.json(items);
}
