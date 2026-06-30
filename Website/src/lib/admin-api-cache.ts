/**
 * In-memory server cache for admin read APIs (per Node process / serverless instance).
 */

type CacheEntry = { data: unknown; ts: number };

const globalForCache = globalThis as unknown as {
  adminApiCache?: Map<string, CacheEntry>;
};

function cacheMap(): Map<string, CacheEntry> {
  if (!globalForCache.adminApiCache) {
    globalForCache.adminApiCache = new Map();
  }
  return globalForCache.adminApiCache;
}

export const ADMIN_API_CACHE_TTL = {
  games: 10 * 60 * 1000,
  modes: 10 * 60 * 1000,
  presets: 5 * 60 * 1000,
  matches: 45 * 1000,
  users: 2 * 60 * 1000,
  deposits: 90 * 1000,
  withdrawals: 90 * 1000,
} as const;

export function getAdminApiCache<T>(key: string, ttlMs: number): T | null {
  const entry = cacheMap().get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) {
    cacheMap().delete(key);
    return null;
  }
  return entry.data as T;
}

export function setAdminApiCache(key: string, data: unknown): void {
  cacheMap().set(key, { data, ts: Date.now() });
}

/** Drop keys that start with prefix (e.g. "matches:"). */
export function invalidateAdminApiCache(prefix?: string): void {
  const map = cacheMap();
  if (!prefix) {
    map.clear();
    return;
  }
  for (const key of Array.from(map.keys())) {
    if (key.startsWith(prefix)) map.delete(key);
  }
}

/** Call after any match create/update/delete so admin + app lists stay in sync. */
export function invalidateMatchListCaches(): void {
  invalidateAdminApiCache("matches:");
  invalidateAdminApiCache("public:matches:");
}
