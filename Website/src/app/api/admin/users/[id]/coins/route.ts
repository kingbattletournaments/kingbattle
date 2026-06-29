import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { invalidateAdminApiCache } from "@/lib/admin-api-cache";
import { normalizeAdminUser, serializeAdminUser } from "@/lib/admin-user";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!admin.coinsAccess) return NextResponse.json({ error: "No coins access" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { amount, description } = body;
  if (amount == null || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 }
    );
  }
  const user = await getStore().addCoins(id, amount, typeof description === "string" ? description : undefined);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  invalidateAdminApiCache("users");
  return NextResponse.json(serializeAdminUser(normalizeAdminUser(user)));
}
