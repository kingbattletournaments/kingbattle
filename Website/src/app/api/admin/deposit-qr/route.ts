import { unstable_noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";

function canManageDepositQr(admin: { isMasterAdmin: boolean; coinsAccess: boolean }) {
  return admin.isMasterAdmin || admin.coinsAccess;
}

export async function GET() {
  unstable_noStore();
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDepositQr(admin)) return NextResponse.json({ error: "No access" }, { status: 403 });
  const url = await getStore().getDepositQrUrl();
  return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageDepositQr(admin)) return NextResponse.json({ error: "No access" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url : null;
  const store = getStore();
  await store.setDepositQrUrl(url);
  const updated = await store.getDepositQrUrl();
  return NextResponse.json({ url: updated });
}
