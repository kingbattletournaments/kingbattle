import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  const url = await getStore().getBannerImageUrl();
  return NextResponse.json({ bannerImageUrl: url });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const body = await request.json();
    const url = body.bannerImageUrl;
    const saved = await getStore().setBannerImageUrl(url);
    return NextResponse.json({ bannerImageUrl: saved });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
