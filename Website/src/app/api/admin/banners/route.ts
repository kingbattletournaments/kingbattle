import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getProductionStoreError } from "@/lib/store-config";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }
  
  try {
    const banners = await getStore().getBanners();
    return NextResponse.json(banners);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch banners" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const storeError = getProductionStoreError();
  if (storeError) {
    return NextResponse.json({ error: storeError }, { status: 503 });
  }
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });

  try {
    const body = await request.json();
    const { imageUrl, linkUrl, displayPlayCarousel, displayEarn } = body;

    if (!imageUrl || !linkUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newBanner = await getStore().addBanner(
      imageUrl,
      linkUrl,
      !!displayPlayCarousel,
      !!displayEarn
    );

    if (!newBanner) {
      return NextResponse.json({ error: "Failed to create banner in database" }, { status: 500 });
    }

    return NextResponse.json(newBanner);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });

  try {
    const body = await request.json();
    const { id, imageUrl, linkUrl, displayPlayCarousel, displayEarn } = body;

    if (!id || !imageUrl || !linkUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updated = await getStore().updateBanner(
      id,
      imageUrl,
      linkUrl,
      !!displayPlayCarousel,
      !!displayEarn
    );

    if (!updated) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing ID parameter" }, { status: 400 });
    }

    const success = await getStore().deleteBanner(id);
    if (!success) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request" }, { status: 400 });
  }
}
