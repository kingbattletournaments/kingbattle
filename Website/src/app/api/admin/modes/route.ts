import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  if (gameId && admin.gamesAccessType === "specific" && !admin.isMasterAdmin) {
    if (!admin.allowedGameIds.includes(gameId)) {
      return NextResponse.json({ error: "No access to this game" }, { status: 403 });
    }
  }
  const store = getStore();
  const modes = await store.gameModes(gameId ?? undefined);
  return NextResponse.json(modes);
}

export async function POST(request: Request) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const store = getStore();
  if (!(await store.canAccessGames(admin.id))) {
    return NextResponse.json({ error: "No games access" }, { status: 403 });
  }
  let { gameId, name, imageUrl } = await request.json();
  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }
  if (!gameId) {
    try {
      gameId = await store.getDefaultGameId();
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to get default game" }, { status: 500 });
    }
  }
  if (gameId && admin.gamesAccessType === "specific" && !admin.isMasterAdmin && !admin.allowedGameIds.includes(gameId)) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }
  const mode = await store.addGameMode(gameId, name, imageUrl ?? null);
  if (!mode) {
    return NextResponse.json({ error: "Failed to create mode in database" }, { status: 500 });
  }
  return NextResponse.json(mode);
}
