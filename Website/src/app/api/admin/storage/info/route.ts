import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { canAccessAdminTab } from "@/lib/admin-tabs";
import { getStorageBounds } from "@/lib/storage-archive";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminTab(admin, "storage")) return NextResponse.json({ error: "No access" }, { status: 403 });

  const bounds = await getStorageBounds();
  return NextResponse.json(bounds);
}
