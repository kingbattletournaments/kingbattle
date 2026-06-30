"use client";

import { useCallback, useEffect, useState } from "react";
import { CoinAmount } from "@/components/ui/CoinIcon";
import { AdminPagination } from "@/components/admin/AdminPagination";

type TxRow = {
  id: string;
  userId: string;
  amount: number;
  type: string;
  description?: string;
  referenceId?: string;
  createdAt: string;
  userDisplayName?: string;
  userEmail?: string;
};

type PaginatedTx = {
  items: TxRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function TransactionsSection() {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const load = useCallback(async (p: number, txId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (txId.trim()) params.set("id", txId.trim().toUpperCase());
      const res = await fetch(`/api/admin/transactions?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as PaginatedTx;
      setRows(data.items ?? []);
      setPage(data.page ?? p);
      setPageSize(data.pageSize ?? 20);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, activeSearch);
  }, [page, activeSearch, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchId.trim().toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Transactions</h1>
        <p className="text-zinc-500 text-sm">
          All coin transactions across the system. Search by 10-character transaction ID.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search transaction ID (10 chars)..."
          value={searchId}
          onChange={(e) => setSearchId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
          className="admin-input rounded-xl px-4 py-2.5 text-sm w-full sm:max-w-xs font-mono uppercase"
        />
        <button type="submit" className="admin-btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold w-fit">
          Search
        </button>
        {activeSearch ? (
          <button
            type="button"
            onClick={() => {
              setSearchId("");
              setActiveSearch("");
              setPage(1);
            }}
            className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 w-fit"
          >
            Clear
          </button>
        ) : null}
      </form>

      <section className="admin-table-panel w-full">
        {loading && rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">Loading transactions…</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">No transactions found</p>
        ) : (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="text-left">Transaction ID</th>
                  <th className="text-left">User</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Description</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs text-zinc-600">{t.id}</td>
                    <td>
                      <div className="font-medium text-zinc-900">{t.userDisplayName ?? t.userId}</div>
                      <div className="text-xs text-zinc-500 font-mono">{t.userId}</div>
                    </td>
                    <td className="text-zinc-600 capitalize">{t.type.replace(/_/g, " ")}</td>
                    <td className="text-zinc-600 text-sm max-w-[240px]">{t.description ?? "—"}</td>
                    <td className="text-right">
                      <CoinAmount
                        amount={t.amount >= 0 ? `+${t.amount}` : `${t.amount}`}
                        size={14}
                        className={`justify-end ${t.amount >= 0 ? "text-emerald-600" : "text-rose-500"}`}
                      />
                    </td>
                    <td className="text-right text-xs text-zinc-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4">
          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            loading={loading}
          />
        </div>
      </section>
    </div>
  );
}
