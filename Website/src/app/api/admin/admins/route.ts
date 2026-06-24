import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";
import { adminClientPayload, canAccessAdminTab, emptyTabAccess, type AdminTabAccess } from "@/lib/admin-tabs";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessAdminTab(admin, "admins")) {
    return NextResponse.json({ error: "Admin tab access required" }, { status: 403 });
  }
  const admins = await getStore().getAllAdmins();
  return NextResponse.json(
    admins.map((a) => ({
      ...adminClientPayload(a),
      createdAt: a.createdAt,
    }))
  );
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin || !canAccessAdminTab(admin, "admins")) {
    return NextResponse.json({ error: "Admin tab access required" }, { status: 403 });
  }
  const body = await request.json();
  const { adminname, password, tabAccess } = body as {
    adminname?: string;
    password?: string;
    tabAccess?: Partial<AdminTabAccess>;
  };
  if (!adminname || !password) {
    return NextResponse.json({ error: "Admin name and password required" }, { status: 400 });
  }
  const mergedTabAccess = { ...emptyTabAccess(), ...(tabAccess ?? {}) };
  const hasAnyTab = Object.values(mergedTabAccess).some(Boolean);
  if (!hasAnyTab) {
    return NextResponse.json({ error: "Select at least one tab permission" }, { status: 400 });
  }
  const newAdmin = await getStore().createAdmin(adminname, password, { tabAccess: mergedTabAccess });
  if (!newAdmin) {
    return NextResponse.json({ error: "Admin name already exists" }, { status: 400 });
  }
  return NextResponse.json({
    ...adminClientPayload(newAdmin),
    createdAt: newAdmin.createdAt,
  });
}
