import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";

async function checkModeAccess(adminId: string, modeId: string): Promise<boolean> {
  const store = getStore();
  const [admin, mode] = await Promise.all([store.getAdminById(adminId), store.getMode(modeId)]);
  if (!admin || !mode) return false;
  if (admin.isMasterAdmin || admin.gamesAccessType === "all") return true;
  return admin.allowedGameIds.includes(mode.gameId);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await checkModeAccess(admin.id, id))) {
    return NextResponse.json({ error: "No access to this mode" }, { status: 403 });
  }
  const store = getStore();
  const ok = await store.deleteMode(id);
  if (!ok) return NextResponse.json({ error: "Mode not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await checkModeAccess(admin.id, id))) {
    return NextResponse.json({ error: "No access to this mode" }, { status: 403 });
  }
  const body = await request.json();
  const { name, imageUrl } = body as { name?: string; imageUrl?: string | null };

  const hasName = typeof name === "string" && name.trim().length > 0;
  const hasImageUrl = imageUrl !== undefined;

  if (!hasName && !hasImageUrl) {
    return NextResponse.json({ error: "name or imageUrl is required" }, { status: 400 });
  }

  const updates: { name?: string; imageUrl?: string | null } = {};
  if (hasName) updates.name = name.trim();
  if (hasImageUrl) updates.imageUrl = imageUrl;

  const store = getStore();
  const mode = await store.updateMode(id, updates);
  if (!mode) return NextResponse.json({ error: "Mode not found" }, { status: 404 });
  return NextResponse.json(mode);
}
