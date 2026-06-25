import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getCachedAdminDashboardStats,
  setCachedAdminDashboardStats,
} from "@/lib/admin-dashboard-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const skipCache = searchParams.get("refresh") === "1";

  if (!skipCache) {
    const cached = getCachedAdminDashboardStats();
    if (cached) return NextResponse.json(cached);
  }

  try {
    const store = getStore();
    const stats = await store.getDashboardStats();
    if (!stats) {
      return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 });
    }

    setCachedAdminDashboardStats(stats);
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 });
  }
}
