/**
 * Browser sessionStorage cache for admin panel (instant restore + stale-while-revalidate).
 */

type CacheEnvelope<T> = { data: T; ts: number; ttl: number };

const PREFIX = "kb_admin_v1:";

export const ADMIN_CLIENT_CACHE_TTL = {
  games: 10 * 60 * 1000,
  modes: 10 * 60 * 1000,
  dashboard: 5 * 60 * 1000,
  presets: 5 * 60 * 1000,
  matches: 90 * 1000,
  users: 2 * 60 * 1000,
  deposits: 90 * 1000,
  withdrawals: 90 * 1000,
  matchDetail: 60 * 1000,
} as const;

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export type AdminCacheRead<T> = {
  data: T;
  stale: boolean;
};

/** Returns cached data; `stale: true` when TTL expired but data still usable for SWR. */
export function readAdminClientCache<T>(
  key: string,
  opts?: { maxStaleMs?: number },
): AdminCacheRead<T> | null {
  const env = readEnvelope<T>(key);
  if (!env) return null;
  const age = Date.now() - env.ts;
  if (age <= env.ttl) return { data: env.data, stale: false };
  const maxStale = opts?.maxStaleMs ?? env.ttl * 2;
  if (age <= maxStale) return { data: env.data, stale: true };
  removeAdminClientCache(key);
  return null;
}

/** Fresh cache only (within TTL). */
export function readAdminClientCacheFresh<T>(key: string): T | null {
  const hit = readAdminClientCache<T>(key);
  return hit && !hit.stale ? hit.data : null;
}

export function writeAdminClientCache<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === "undefined") return;
  try {
    const env: CacheEnvelope<T> = { data, ts: Date.now(), ttl: ttlMs };
    sessionStorage.setItem(storageKey(key), JSON.stringify(env));
  } catch {
    // quota exceeded — ignore
  }
}

export function removeAdminClientCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

export function clearAdminClientCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function hasAdminBootstrapCache(): boolean {
  return (
    !!readAdminClientCacheFresh<unknown>("core:games") &&
    !!readAdminClientCacheFresh<unknown>("core:modes")
  );
}

export async function fetchAdminJsonCached<T>(
  url: string,
  cacheKey: string,
  ttlMs: number,
  force = false,
): Promise<T | null> {
  if (!force) {
    const hit = readAdminClientCacheFresh<T>(cacheKey);
    if (hit) return hit;
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    writeAdminClientCache(cacheKey, data, ttlMs);
    return data;
  } catch {
    const stale = readAdminClientCache<T>(cacheKey);
    return stale?.data ?? null;
  }
}
