import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  const settings = await getStore().getReferralSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const body = await request.json();
    const { enabled, rewardCoins, bannerUrl } = body;
    if (typeof enabled !== "boolean" || isNaN(Number(rewardCoins)) || Number(rewardCoins) < 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }
    const settings = await getStore().setReferralSettings(enabled, Number(rewardCoins), bannerUrl || "");
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
