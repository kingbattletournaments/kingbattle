import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { parsePaginationParams } from "@/lib/pagination";
import { normalizeAdminUser, serializeAdminUser } from "@/lib/admin-user";

export async function GET(request: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!admin.usersAccess && !admin.coinsAccess) {
      return NextResponse.json({ error: "No users/coins access" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePaginationParams(searchParams);
    const search = searchParams.get("search") ?? undefined;
    const blockedParam = searchParams.get("blocked");
    const blocked =
      blockedParam === "blocked" || blockedParam === "active" ? blockedParam : "all";

    const result = await getStore().usersPaginated({ page, pageSize, search, blocked });
    return NextResponse.json({
      ...result,
      items: result.items.map((u) => serializeAdminUser(normalizeAdminUser(u))),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
