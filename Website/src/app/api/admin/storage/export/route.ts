import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { canAccessAdminTab } from "@/lib/admin-tabs";
import {
  fetchStorageArchive,
  getStorageBounds,
  purgeStorageArchive,
  validateStorageRange,
} from "@/lib/storage-archive";
import { buildStorageArchiveZip } from "@/lib/storage-export";
import { parseDateOnly } from "@/lib/storage-dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminTab(admin, "storage")) return NextResponse.json({ error: "No access" }, { status: 403 });

  try {
    const body = await request.json();
    const startDate = parseDateOnly(String(body.startDate ?? ""));
    const endDate = parseDateOnly(String(body.endDate ?? ""));
    const deleteAfter = Boolean(body.deleteAfter);

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Valid startDate and endDate (YYYY-MM-DD) required" }, { status: 400 });
    }

    const bounds = await getStorageBounds();
    const err = validateStorageRange(startDate, endDate, bounds);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const preview = await fetchStorageArchive(startDate, endDate);
    if (preview.transactions.length === 0 && preview.matches.length === 0) {
      return NextResponse.json({ error: "No transactions or matches found in this date range." }, { status: 400 });
    }

    const zipBuffer = await buildStorageArchiveZip(preview);

    let purgeResult: { deletedTransactions: number; deletedMatches: number } | null = null;
    if (deleteAfter) {
      purgeResult = await purgeStorageArchive(startDate, endDate);
    }

    const filename = deleteAfter
      ? `king-battle-archive_${startDate}_to_${endDate}_deleted.zip`
      : `king-battle-archive_${startDate}_to_${endDate}.zip`;

    const headers: Record<string, string> = {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    };
    if (purgeResult) {
      headers["X-Archive-Deleted-Transactions"] = String(purgeResult.deletedTransactions);
      headers["X-Archive-Deleted-Matches"] = String(purgeResult.deletedMatches);
    }

    return new NextResponse(new Uint8Array(zipBuffer), { status: 200, headers });
  } catch (e) {
    console.error("storage export failed:", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
