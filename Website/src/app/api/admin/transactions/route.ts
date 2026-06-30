import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { parsePaginationParams } from "@/lib/pagination";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.coinsAccess) return NextResponse.json({ error: "No coins access" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams(searchParams);
  const id = searchParams.get("id") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const result = await getStore().transactionsPaginated({ page, pageSize, id, userId });
  return NextResponse.json(result);
}
