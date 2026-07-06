"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminProgressOverlay } from "@/components/admin/AdminProgressOverlay";
import {
  delay,
  progressMessage,
  useSimulatedProgress,
} from "@/components/admin/useSimulatedProgress";

type StorageBounds = {
  minStartDate: string;
  maxEndDate: string;
  purgeCursor: string | null;
};

type StoragePreview = {
  transactionCount: number;
  matchCount: number;
};

const EXPORT_STEPS = [
  { until: 22, text: "Collecting coin transactions from the database…" },
  { until: 45, text: "Loading match records and participant results…" },
  { until: 68, text: "Generating PDF reports and spreadsheets…" },
  { until: 88, text: "Packaging archive for download…" },
];

export function StorageSection({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [bounds, setBounds] = useState<StorageBounds | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preview, setPreview] = useState<StoragePreview | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportTitle, setExportTitle] = useState("Preparing archive…");
  const [error, setError] = useState<string | null>(null);

  const { percent, finish } = useSimulatedProgress(exporting, { estimatedMs: 120000, cap: 94 });

  const exportMessage = useMemo(
    () => progressMessage(percent, EXPORT_STEPS, "Finalizing download…"),
    [percent],
  );

  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage/info");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as StorageBounds;
      setBounds(data);
      setStartDate(data.minStartDate);
      setEndDate(data.maxEndDate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load storage info");
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const refreshPreview = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ startDate, endDate });
      const res = await fetch(`/api/admin/storage/preview?${qs}`);
      if (!res.ok) {
        const errText = await res.text();
        try {
          const parsed = JSON.parse(errText);
          throw new Error(parsed.error ?? errText);
        } catch {
          throw new Error(errText);
        }
      }
      setPreview(await res.json());
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (bounds && startDate && endDate) {
      const t = setTimeout(refreshPreview, 400);
      return () => clearTimeout(t);
    }
  }, [bounds, startDate, endDate, refreshPreview]);

  const runExport = async (deleteAfter: boolean) => {
    if (!startDate || !endDate) return;
    if (deleteAfter) {
      const ok = confirm(
        `Download archive and PERMANENTLY DELETE all transactions (${preview?.transactionCount ?? "?"})\n` +
          `and matches (${preview?.matchCount ?? "?"}) from ${startDate} to ${endDate}?\n\n` +
          "This cannot be undone. Ensure the download completed successfully.",
      );
      if (!ok) return;
    }

    setExporting(true);
    setExportTitle(deleteAfter ? "Archiving and removing data…" : "Building archive…");
    setError(null);
    try {
      const res = await fetch("/api/admin/storage/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, deleteAfter }),
      });
      if (!res.ok) {
        const errText = await res.text();
        try {
          const parsed = JSON.parse(errText);
          throw new Error(parsed.error ?? errText);
        } catch {
          throw new Error(errText);
        }
      }

      const blob = await res.blob();
      finish();
      await delay(450);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = deleteAfter
        ? `king-battle-archive_${startDate}_to_${endDate}_deleted.zip`
        : `king-battle-archive_${startDate}_to_${endDate}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (deleteAfter) {
        await loadInfo();
        onSuccess("Archive downloaded and data removed from database");
      } else {
        onSuccess("Archive downloaded");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const hasData = preview && (preview.transactionCount > 0 || preview.matchCount > 0);

  return (
    <>
      <AdminProgressOverlay
        open={exporting}
        title={exportTitle}
        message={exportMessage}
        progress={percent}
        warning="This may take several minutes for large date ranges. Please don't close this window or leave the admin panel until the download starts."
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Storage Management</h1>
          <p className="text-zinc-500 text-sm max-w-2xl">
            Export transactions and matches for a date range to free database space. Archives include PDF
            reports (bank-style statement for transactions, full match results for matches), CSV spreadsheets,
            and a JSON backup. End date cannot be today — only data up to yesterday can be archived.
          </p>
        </div>

        {loadingInfo ? (
          <div className="admin-panel p-6 text-sm text-zinc-500">Loading storage settings…</div>
        ) : bounds ? (
          <>
            <div className="admin-panel p-5 space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold">Available date range</p>
                <p className="mt-1">
                  Earliest selectable start: <strong>{bounds.minStartDate}</strong>
                  {bounds.purgeCursor ? " (data before this date was already archived)" : ""}
                </p>
                <p>
                  Latest selectable end: <strong>{bounds.maxEndDate}</strong> (yesterday)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-zinc-600">Start date</span>
                  <input
                    type="date"
                    value={startDate}
                    min={bounds.minStartDate}
                    max={endDate || bounds.maxEndDate}
                    disabled={exporting}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="admin-input w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-zinc-600">End date</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || bounds.minStartDate}
                    max={bounds.maxEndDate}
                    disabled={exporting}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="admin-input w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
                  />
                </label>
              </div>

              {loadingPreview ? (
                <p className="text-sm text-zinc-500">Counting records…</p>
              ) : preview ? (
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Transactions</p>
                    <p className="text-2xl font-bold text-zinc-900">{preview.transactionCount}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3">
                    <p className="text-xs text-zinc-500 uppercase font-bold">Matches</p>
                    <p className="text-2xl font-bold text-zinc-900">{preview.matchCount}</p>
                  </div>
                </div>
              ) : null}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  disabled={exporting || !hasData}
                  onClick={() => runExport(false)}
                  className="admin-btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Download only
                </button>
                <button
                  type="button"
                  disabled={exporting || !hasData}
                  onClick={() => runExport(true)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Download + delete from database
                </button>
              </div>

              <p className="text-xs text-zinc-500">
                Download produces a ZIP with transactions.pdf, matches.pdf, CSV files, and archive.json.
                Delete removes matches (by scheduled date) and transactions (by created date) in the range,
                then advances the earliest available start date to the day after your end date.
              </p>
            </div>
          </>
        ) : (
          <div className="admin-panel p-6 text-sm text-red-600">{error ?? "Unable to load storage info"}</div>
        )}
      </div>
    </>
  );
}
