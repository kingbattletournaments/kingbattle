import type { DashboardStats } from "@/lib/dashboard-stats";

const CACHE_DURATION_MS = 5 * 60 * 1000;

const globalForCache = globalThis as unknown as {
  adminDashboardStatsCache?: DashboardStats;
  adminDashboardStatsCacheTime?: number;
};

export function getCachedAdminDashboardStats(): DashboardStats | null {
  const now = Date.now();
  if (
    globalForCache.adminDashboardStatsCache &&
    globalForCache.adminDashboardStatsCacheTime &&
    now - globalForCache.adminDashboardStatsCacheTime < CACHE_DURATION_MS
  ) {
    return globalForCache.adminDashboardStatsCache;
  }
  return null;
}

export function setCachedAdminDashboardStats(stats: DashboardStats) {
  globalForCache.adminDashboardStatsCache = stats;
  globalForCache.adminDashboardStatsCacheTime = Date.now();
}

export function invalidateAdminDashboardStatsCache() {
  globalForCache.adminDashboardStatsCache = undefined;
  globalForCache.adminDashboardStatsCacheTime = undefined;
}
