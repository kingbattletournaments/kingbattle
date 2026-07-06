import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { canAccessAdminTab } from "@/lib/admin-tabs";
import {
  getStorageBounds,
  previewStorageRange,
  validateStorageRange,
} from "@/lib/storage-archive";
import { parseDateOnly } from "@/lib/storage-dates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminTab(admin, "storage")) return NextResponse.json({ error: "No access" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const startDate = parseDateOnly(searchParams.get("startDate") ?? "");
  const endDate = parseDateOnly(searchParams.get("endDate") ?? "");
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Valid startDate and endDate (YYYY-MM-DD) required" }, { status: 400 });
  }

  const bounds = await getStorageBounds();
  const err = validateStorageRange(startDate, endDate, bounds);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const preview = await previewStorageRange(startDate, endDate);
  return NextResponse.json({ startDate, endDate, ...preview });
}
