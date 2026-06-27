import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import {
  ADMIN_API_CACHE_TTL,
  getAdminApiCache,
  setAdminApiCache,
} from "@/lib/admin-api-cache";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No users/coins access" }, { status: 403 });

    const cached = getAdminApiCache<unknown>("users:all", ADMIN_API_CACHE_TTL.users);
    if (cached) return NextResponse.json(cached);

    const users = await getStore().users();
    setAdminApiCache("users:all", users);
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
