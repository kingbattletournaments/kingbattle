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
    const settings = await getStore().getReferralSettings();
    const signupBonus = await getStore().getSignupBonus();
    return NextResponse.json({
      ...settings,
      signupBonus
    }, { headers: NO_STORE });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch settings" }, { status: 500 });
  }
}
