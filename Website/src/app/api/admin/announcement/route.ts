import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  const text = await getStore().getAnnouncementText();
  return NextResponse.json({ announcementText: text });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const body = await request.json();
    const text = body.announcementText;
    const saved = await getStore().setAnnouncementText(text);
    return NextResponse.json({ announcementText: saved });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
