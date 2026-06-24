import { unstable_noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

function normalizeSupportUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function GET() {
  unstable_noStore();
  const url = normalizeSupportUrl(await getStore().getCustomerSupportUrl());
  return NextResponse.json({ url, customerSupportUrl: url }, { headers: NO_STORE });
}