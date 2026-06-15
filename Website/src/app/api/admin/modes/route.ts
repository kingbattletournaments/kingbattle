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
  try {
    const storeError = getProductionStoreError();
    if (storeError) {
      return NextResponse.json({ error: storeError }, { status: 503 });
    }

    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    let { gameId, name, imageUrl } = body ?? {};
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const store = getStore();
    const canAccessGames = await store.canAccessGames(admin.id);
    if (!canAccessGames) {
      return NextResponse.json(
        {
          error: "No games access",
          debug: {
            adminId: admin.id,
            gamesAccessType: admin.gamesAccessType,
            isMasterAdmin: admin.isMasterAdmin,
            allowedGameIds: admin.allowedGameIds,
          },
        },
        { status: 403 }
      );
    }

    if (!gameId) {
      try {
        gameId = await store.getDefaultGameId();
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to get default game" },
          { status: 500 }
        );
      }
    }

    if (
      gameId &&
      admin.gamesAccessType === "specific" &&
      !admin.isMasterAdmin &&
      !admin.allowedGameIds.includes(gameId)
    ) {
      return NextResponse.json(
        {
          error: "No access to this game",
          debug: {
            gameId,
            adminId: admin.id,
            gamesAccessType: admin.gamesAccessType,
            allowedGameIds: admin.allowedGameIds,
          },
        },
        { status: 403 }
      );
    }

    const mode = await store.addGameMode(gameId, name, imageUrl ?? null);
    if (!mode) {
      return NextResponse.json(
        {
          error: "Failed to create mode in database",
          debug: { adminId: admin.id, gameId, name },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(mode);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
