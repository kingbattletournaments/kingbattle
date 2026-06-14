import { unstable_noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

export async function GET() {
  unstable_noStore();
  try {
    const banners = await getStore().getBanners();
    return NextResponse.json(banners, { headers: NO_STORE });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch banners" }, { status: 500 });
  }
}
