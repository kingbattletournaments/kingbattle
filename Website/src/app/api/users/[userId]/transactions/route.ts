import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";
import { buildUserTransactionFeed } from "@/lib/user-transaction-feed";

export async function GET(_request: Request) {
  const userId = await getAppUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = getStore();
  const merged = await buildUserTransactionFeed(store, userId);
  return NextResponse.json(merged);
}
