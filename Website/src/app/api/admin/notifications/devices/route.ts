import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getFirebaseConfigError } from "@/lib/fcm";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";

export async function GET() {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }

  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!admin.isMasterAdmin && !admin.usersAccess) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }

  const firebaseError = getFirebaseConfigError();

  const store = getStore();
  const devices = await store.listFcmDeviceRegistrations();

  return NextResponse.json({
    ok: true,
    count: devices.length,
    devices,
    firebaseConfigured: !firebaseError,
    firebaseError,
  });
}
