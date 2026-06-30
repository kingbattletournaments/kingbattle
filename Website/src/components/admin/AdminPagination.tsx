"use client";

type AdminPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
};

export function AdminPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  loading = false,
}: AdminPaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-[5rem] text-center text-sm text-zinc-600">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
