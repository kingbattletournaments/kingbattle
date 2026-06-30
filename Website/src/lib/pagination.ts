export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MATCH_LIST_PAGE_SIZE = 5;
export const MATCH_LIST_MAX_PAGE_SIZE = 20;

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

export function parsePaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawLimit));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

export type MatchListStatus = "ongoing" | "upcoming" | "completed";

export function parseMatchListParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawLimit = parseInt(searchParams.get("limit") ?? String(MATCH_LIST_PAGE_SIZE), 10) || MATCH_LIST_PAGE_SIZE;
  const pageSize = Math.min(MATCH_LIST_MAX_PAGE_SIZE, Math.max(1, rawLimit));
  const rawStatus = (searchParams.get("status") ?? "upcoming").toLowerCase();
  const status: MatchListStatus =
    rawStatus === "ongoing" ? "ongoing" : rawStatus === "completed" || rawStatus === "results" ? "completed" : "upcoming";
  return { page, pageSize, status };
}
