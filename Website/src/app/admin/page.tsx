"use client";

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { buildMatchScheduleTimes } from "@/lib/match-preset-schedule";
import { formatMatchDateTime } from "@/lib/format-match-datetime";
import {
  ADMIN_TAB_DEFINITIONS,
  ALL_ADMIN_TAB_IDS,
  canAccessAdminTab,
  emptyTabAccess,
  tabAccessLabel,
  type AdminTabAccess,
  type AdminTabId,
  type AdminPanelTab,
} from "@/lib/admin-tabs";
import {
  buildAdminNavQuery,
  readAdminNavParams,
  type AdminMatchStatus,
  type AdminMatchView,
} from "@/lib/admin-nav";
import { AdminTabIcon } from "@/components/admin/AdminTabIcon";
import { AdminMatchCard, getAdminMatchBanner } from "@/components/admin/AdminMatchCard";
import { CoinAmount } from "@/components/ui/CoinIcon";
import { AdminMatchSlotsPanel } from "@/components/admin/AdminMatchSlotsPanel";
import {
  AdminBannerGridSkeleton,
  AdminFormPanelSkeleton,
  AdminMatchDetailSkeleton,
  AdminTabSkeleton,
  DashboardSkeleton,
} from "@/components/admin/AdminSkeletons";
import type { DashboardStats } from "@/lib/dashboard-stats";
import { validateMaxParticipants } from "@/lib/match-slots";
import {
  ADMIN_CLIENT_CACHE_TTL,
  clearAdminClientCache,
  hasAdminBootstrapCache,
  readAdminClientCache,
  readAdminClientCacheFresh,
  removeAdminClientCache,
  writeAdminClientCache,
} from "@/lib/admin-client-cache";
import { normalizeAdminUser } from "@/lib/admin-user";

type Tab = "dashboard" | "modes" | "presets" | "moneyorders" | "withdrawals" | "admins" | "notifications" | "appsettings" | "banners" | "referrals" | "users";
type Game = { id: string; name: string; imageUrl: string | null };
type GameMode = { id: string; gameId: string; name: string; imageUrl: string | null };
type MatchType = "solo" | "duo" | "squad";
type RankReward = { fromRank: number; toRank: number; coins: number };
type PrizePool = { coinsPerKill: number; totalPrizePool?: number; rankRewards: RankReward[] };
type Match = {
  id: string;
  gameModeId: string;
  title: string;
  entryFee: number;
  roomCode: string | null;
  roomPassword: string | null;
  status: string;
  registrationLocked?: boolean;
  matchType?: MatchType;
  prizePool?: PrizePool;
  scheduledAt?: string;
  maxParticipants?: number;
  image?: string | null;
  participantCount?: number;
  map?: string;
};
type MatchPreset = {
  id: string;
  gameModeId: string;
  name: string;
  title: string;
  entryFee: number;
  maxParticipants: number;
  matchType?: MatchType;
  map?: string;
  prizePool?: PrizePool;
  image?: string | null;
};
type User = { id: string; email: string; displayName: string; coins: number; wonCoins?: number; isBlocked?: boolean; blockReason?: string | null; username?: string };

type AdminSession = {
  id: string;
  adminname: string;
  isMasterAdmin: boolean;
  usersAccess: boolean;
  coinsAccess: boolean;
  gamesAccessType: "all" | "specific";
  allowedGameIds: string[];
  tabAccess: AdminTabAccess;
};

type MatchBulkSelectControls = {
  selectedCount: number;
  totalSelectable: number;
  selectAll: () => void;
  exitSelection: () => void;
};

type AdminTabCachePayload = {
  matches?: Match[];
  presets?: MatchPreset[];
  users?: User[];
  deposits?: unknown[];
  withdrawals?: unknown[];
};

function adminTabClientKey(tab: Tab, modeId?: string | null): string {
  const cacheKey = tab === "modes" && modeId ? `modes:${modeId}` : tab;
  return `tab:${cacheKey}`;
}

function normalizeUsersList(data: unknown): User[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const u = normalizeAdminUser(row);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      coins: u.coins,
      wonCoins: u.wonCoins,
      isBlocked: u.isBlocked,
      blockReason: u.blockReason,
      username: u.username,
    };
  });
}

function hasAdminTabCache(tab: Tab, modeId?: string | null): boolean {
  return !!readAdminClientCache<AdminTabCachePayload>(adminTabClientKey(tab, modeId));
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page min-h-screen">
          <div className="admin-container">
            <div className="admin-main-content w-full lg:ml-[260px]">
              <DashboardSkeleton />
            </div>
          </div>
        </div>
      }
    >
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navParams = useMemo(() => readAdminNavParams(searchParams), [searchParams]);

  const patchAdminNav = useCallback(
    (patch: Parameters<typeof buildAdminNavQuery>[1]) => {
      const qs = buildAdminNavQuery(searchParams, patch);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [session, setSession] = useState<AdminSession | null>(null);
  const selectedGameId = navParams.game;
  const selectedModeId = navParams.mode;
  const tab = useMemo((): Tab => {
    const raw = navParams.tab as Tab;
    const allowed: Tab[] = [
      "dashboard",
      ...ALL_ADMIN_TAB_IDS.filter((id) => (session ? canAccessAdminTab(session, id) : true)),
    ];
    return allowed.includes(raw) ? raw : "dashboard";
  }, [navParams.tab, session]);
  const [games, setGames] = useState<Game[]>(() =>
    typeof window !== "undefined" ? (readAdminClientCacheFresh<Game[]>("core:games") ?? []) : [],
  );
  const [modes, setModes] = useState<GameMode[]>(() =>
    typeof window !== "undefined" ? (readAdminClientCacheFresh<GameMode[]>("core:modes") ?? []) : [],
  );
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchPresets, setMatchPresets] = useState<MatchPreset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(() =>
    typeof window !== "undefined" ? readAdminClientCacheFresh<DashboardStats>("dashboard") : null,
  );
  const [loading, setLoading] = useState(() =>
    typeof window === "undefined" ? true : !hasAdminBootstrapCache(),
  );
  const [tabLoading, setTabLoading] = useState(false);
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [matchBulkSelect, setMatchBulkSelect] = useState<MatchBulkSelectControls | null>(null);

  const hasSpecificGameAccess = session?.gamesAccessType === "specific" && !session?.isMasterAdmin;
  const hasSingleGameAccess = hasSpecificGameAccess && session && session.allowedGameIds.length === 1;

  const visibleTabs: { id: Tab; label: string }[] = session
    ? [
        { id: "dashboard", label: "Dashboard" },
        ...ADMIN_TAB_DEFINITIONS.filter((def) => canAccessAdminTab(session, def.id)).map((def) => ({
          id: def.id as Tab,
          label: def.label,
        })),
      ]
    : [];

  const goToTab = useCallback(
    (nextTab: Tab) => {
      const patch: Parameters<typeof buildAdminNavQuery>[1] = { tab: nextTab };
      if (nextTab !== "modes" && nextTab !== "presets") {
        patch.game = null;
        patch.mode = null;
        patch.mstatus = null;
        patch.match = null;
        patch.mview = null;
      } else if (hasSingleGameAccess && session && games.length > 0) {
        patch.game = session.allowedGameIds[0];
        patch.mode = null;
      }
      patchAdminNav(patch);
    },
    [games.length, hasSingleGameAccess, patchAdminNav, session],
  );

  useEffect(() => {
    if (!session) return;
    const allowed: Tab[] = [
      "dashboard",
      ...ALL_ADMIN_TAB_IDS.filter((id) => canAccessAdminTab(session, id)),
    ];
    if (!allowed.includes(navParams.tab as Tab)) {
      patchAdminNav({
        tab: "dashboard",
        game: null,
        mode: null,
        mstatus: null,
        match: null,
        mview: null,
      });
    }
  }, [session, navParams.tab, patchAdminNav]);

  // Automatically select the first game (Free Fire) to bypass the Games selection screen
  useEffect(() => {
    if (tab !== "modes") return;
    if (games.length > 0 && !selectedGameId && !selectedModeId) {
      patchAdminNav({ game: games[0].id });
    }
  }, [games, selectedGameId, selectedModeId, tab, patchAdminNav]);

  // Restore game id when only mode is present in the URL (e.g. after refresh)
  useEffect(() => {
    if (!selectedModeId || selectedGameId || modes.length === 0) return;
    const mode = modes.find((m) => m.id === selectedModeId);
    if (mode) patchAdminNav({ game: mode.gameId });
  }, [selectedModeId, selectedGameId, modes, patchAdminNav]);

  const fetchSessionAndCore = async (): Promise<AdminSession | null> => {
    const hadBootstrapCache = hasAdminBootstrapCache();
    if (hadBootstrapCache) setLoading(false);

    const sessionRes = await fetch("/api/admin/session", { cache: "no-store" });
    const sessionData = await sessionRes.json();
    if (!sessionData.admin) {
      router.replace("/admin/login");
      return null;
    }
    setSession(sessionData.admin);
    if (!hadBootstrapCache) setLoading(true);
    try {
      const [gRes, mRes] = await Promise.all([
        fetch("/api/admin/games", { cache: "no-store" }),
        fetch("/api/admin/modes", { cache: "no-store" }),
      ]);
      if (gRes.ok) {
        const data = await gRes.json();
        setGames(data);
        writeAdminClientCache("core:games", data, ADMIN_CLIENT_CACHE_TTL.games);
      }
      if (mRes.ok) {
        const data = await mRes.json();
        setModes(data);
        writeAdminClientCache("core:modes", data, ADMIN_CLIENT_CACHE_TTL.modes);
      }
    } catch {
      setMessage({ type: "err", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
    return sessionData.admin as AdminSession;
  };

  const loadDashboardStats = useCallback(async (force = false) => {
    if (!force) {
      const cached = readAdminClientCache<DashboardStats>("dashboard");
      if (cached) {
        setDashboardStats(cached.data);
        loadedTabsRef.current.add("dashboard");
        if (!cached.stale) return;
      } else if (loadedTabsRef.current.has("dashboard")) {
        return;
      }
    }

    if (!readAdminClientCache<DashboardStats>("dashboard") || force) {
      setTabLoading(true);
    }
    try {
      const url = force ? "/api/admin/dashboard/stats?refresh=1" : "/api/admin/dashboard/stats";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
        writeAdminClientCache("dashboard", data, ADMIN_CLIENT_CACHE_TTL.dashboard);
        loadedTabsRef.current.add("dashboard");
      } else {
        setMessage({ type: "err", text: "Failed to load dashboard stats" });
      }
    } catch {
      setMessage({ type: "err", text: "Failed to load dashboard stats" });
    } finally {
      setTabLoading(false);
    }
  }, []);

  const loadTabData = useCallback(
    async (t: Tab, adminSession: AdminSession, force = false) => {
      if (t === "dashboard") {
        await loadDashboardStats(force);
        return;
      }

      const cacheKey = t === "modes" && selectedModeId ? `modes:${selectedModeId}` : t;
      const clientKey = adminTabClientKey(t, selectedModeId);

      if (!force) {
        const cached = readAdminClientCache<AdminTabCachePayload>(clientKey);
        if (cached) {
          if (cached.data.matches && selectedModeId) {
            setMatches((prev) => [
              ...prev.filter((m) => m.gameModeId !== selectedModeId),
              ...cached.data.matches!,
            ]);
          }
          if (cached.data.presets) {
            if (selectedModeId) {
              setMatchPresets((prev) => [
                ...prev.filter((p) => p.gameModeId !== selectedModeId),
                ...cached.data.presets!,
              ]);
            } else {
              setMatchPresets(cached.data.presets);
            }
          }
          if (cached.data.users) setUsers(normalizeUsersList(cached.data.users));
          if (cached.data.deposits) setDeposits(cached.data.deposits);
          if (cached.data.withdrawals) setWithdrawals(cached.data.withdrawals);
          loadedTabsRef.current.add(cacheKey);
          if (!cached.stale) return;
        } else if (loadedTabsRef.current.has(cacheKey)) {
          return;
        }
      }

      if (!readAdminClientCache(clientKey)) setTabLoading(true);

      try {
        switch (t) {
          case "modes": {
            const payload: AdminTabCachePayload = {};
            if (selectedModeId) {
              const [matRes, presetRes] = await Promise.all([
                fetch(`/api/admin/matches?modeId=${encodeURIComponent(selectedModeId)}`, { cache: "no-store" }),
                fetch(`/api/admin/match-presets?modeId=${encodeURIComponent(selectedModeId)}`, { cache: "no-store" }),
              ]);
              if (matRes.ok) {
                const modeMatches = await matRes.json();
                payload.matches = modeMatches;
                setMatches((prev) => [
                  ...prev.filter((m) => m.gameModeId !== selectedModeId),
                  ...modeMatches,
                ]);
              }
              if (presetRes.ok) {
                const modePresets = await presetRes.json();
                payload.presets = modePresets;
                setMatchPresets((prev) => [
                  ...prev.filter((p) => p.gameModeId !== selectedModeId),
                  ...modePresets,
                ]);
              }
            }
            if (canAccessAdminTab(adminSession, "users")) {
              const uRes = await fetch("/api/admin/users", { cache: "no-store" });
              if (uRes.ok) {
                const data = await uRes.json();
                payload.users = normalizeUsersList(data);
                setUsers(payload.users!);
              }
            }
            writeAdminClientCache(clientKey, payload, ADMIN_CLIENT_CACHE_TTL.matches);
            loadedTabsRef.current.add(cacheKey);
            break;
          }
          case "presets": {
            const presetRes = await fetch("/api/admin/match-presets", { cache: "no-store" });
            if (presetRes.ok) {
              const data = await presetRes.json();
              setMatchPresets(data);
              writeAdminClientCache(clientKey, { presets: data }, ADMIN_CLIENT_CACHE_TTL.presets);
            }
            loadedTabsRef.current.add(cacheKey);
            break;
          }
          case "moneyorders": {
            const payload: AdminTabCachePayload = {};
            const tasks: Promise<void>[] = [];
            if (canAccessAdminTab(adminSession, "moneyorders")) {
              tasks.push(
                fetch("/api/admin/deposits", { cache: "no-store" }).then(async (r) => {
                  if (r.ok) {
                    payload.deposits = await r.json();
                    setDeposits(payload.deposits!);
                  }
                }),
              );
            }
            if (canAccessAdminTab(adminSession, "users")) {
              tasks.push(
                fetch("/api/admin/users", { cache: "no-store" }).then(async (r) => {
                  if (r.ok) {
                    const data = await r.json();
                    payload.users = normalizeUsersList(data);
                    setUsers(payload.users!);
                  }
                }),
              );
            }
            await Promise.all(tasks);
            writeAdminClientCache(clientKey, payload, ADMIN_CLIENT_CACHE_TTL.deposits);
            loadedTabsRef.current.add(cacheKey);
            break;
          }
          case "withdrawals": {
            const payload: AdminTabCachePayload = {};
            const tasks: Promise<void>[] = [];
            if (canAccessAdminTab(adminSession, "withdrawals")) {
              tasks.push(
                fetch("/api/admin/withdrawals", { cache: "no-store" }).then(async (r) => {
                  if (r.ok) {
                    payload.withdrawals = await r.json();
                    setWithdrawals(payload.withdrawals!);
                  }
                }),
              );
            }
            if (canAccessAdminTab(adminSession, "users")) {
              tasks.push(
                fetch("/api/admin/users", { cache: "no-store" }).then(async (r) => {
                  if (r.ok) {
                    const data = await r.json();
                    payload.users = normalizeUsersList(data);
                    setUsers(payload.users!);
                  }
                }),
              );
            }
            await Promise.all(tasks);
            writeAdminClientCache(clientKey, payload, ADMIN_CLIENT_CACHE_TTL.withdrawals);
            loadedTabsRef.current.add(cacheKey);
            break;
          }
          case "users": {
            const uRes = await fetch("/api/admin/users", { cache: "no-store" });
            if (uRes.ok) {
              const data = await uRes.json();
              const normalized = normalizeUsersList(data);
              setUsers(normalized);
              writeAdminClientCache(clientKey, { users: normalized }, ADMIN_CLIENT_CACHE_TTL.users);
            }
            loadedTabsRef.current.add(cacheKey);
            break;
          }
          default:
            loadedTabsRef.current.add(cacheKey);
            break;
        }
      } catch {
        setMessage({ type: "err", text: "Failed to load tab data" });
      } finally {
        setTabLoading(false);
      }
    },
    [loadDashboardStats, selectedModeId],
  );

  const invalidateDashboardCache = () => {
    loadedTabsRef.current.delete("dashboard");
    removeAdminClientCache("dashboard");
    setDashboardStats(null);
  };

  const patchUserInList = useCallback((updated: User) => {
    const normalized = normalizeAdminUser(updated);
    const next: User = {
      id: normalized.id,
      email: normalized.email,
      displayName: normalized.displayName,
      coins: normalized.coins,
      wonCoins: normalized.wonCoins,
      isBlocked: normalized.isBlocked,
      blockReason: normalized.blockReason,
      username: normalized.username,
    };
    setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)));
    removeAdminClientCache(adminTabClientKey("users"));
    loadedTabsRef.current.delete("users");
  }, []);

  const refreshCurrentTab = async (showLoading = true) => {
    if (!session) return;
    const cacheKey = tab === "modes" && selectedModeId ? `modes:${selectedModeId}` : tab;
    loadedTabsRef.current.delete(cacheKey);
    removeAdminClientCache(adminTabClientKey(tab, selectedModeId));
    invalidateDashboardCache();
    if (tab === "dashboard") {
      if (showLoading) setTabLoading(true);
      await loadDashboardStats(true);
      if (showLoading) setTabLoading(false);
    } else {
      await loadTabData(tab, session, true);
    }
  };

  useEffect(() => {
    (async () => {
      const adminSession = await fetchSessionAndCore();
      if (!adminSession) return;
      const params = readAdminNavParams(searchParams);
      const initialTab = params.tab as Tab;
      const allowed: Tab[] = [
        "dashboard",
        ...ALL_ADMIN_TAB_IDS.filter((id) => canAccessAdminTab(adminSession, id)),
      ];
      if (initialTab === "dashboard" || !allowed.includes(initialTab)) {
        await loadDashboardStats();
      } else {
        await loadTabData(initialTab, adminSession);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session || tab === "dashboard") return;
    loadTabData(tab, session);
  }, [tab, session, loadTabData]);

  useEffect(() => {
    if (!session || tab !== "modes" || !selectedModeId) return;
    loadTabData("modes", session, false);
  }, [selectedModeId, tab, session, loadTabData]);

  const showMsg = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = async () => {
    clearAdminClientCache();
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="flex items-center gap-3">
          {matchBulkSelect ? (
            <>
              <button
                type="button"
                onClick={matchBulkSelect.selectAll}
                className="admin-btn-primary rounded-xl px-4 py-2 text-sm font-semibold transition"
              >
                Select All
              </button>
              <span className="text-sm text-zinc-500">
                {matchBulkSelect.selectedCount} of {matchBulkSelect.totalSelectable} selected
              </span>
            </>
          ) : (
            <>
              {/* Hamburger for mobile */}
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <Image
                  src="/app-logo.jpg"
                  alt="King Battle"
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover border border-zinc-200"
                  priority
                />
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900 text-zinc-900 border border-zinc-900 normal-case hidden sm:inline-block">
                  Admin
                </span>
              </div>
            </>
          )}
        </div>
        
        {session && (
          <div className="flex items-center gap-3">
            {matchBulkSelect ? (
              <button
                type="button"
                onClick={matchBulkSelect.exitSelection}
                className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 text-sm font-semibold transition"
              >
                Cancel
              </button>
            ) : (
              <>
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs text-zinc-500 font-semibold">Logged in as</span>
                  <span className="text-sm text-zinc-900 font-bold font-mono">{session.adminname}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="admin-btn-primary flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {sidebarOpen && (
        <div 
          className="admin-sidebar-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="flex flex-col gap-1">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                goToTab(t.id);
                setSidebarOpen(false);
              }}
              className={`admin-sidebar-item ${tab === t.id ? "active" : ""}`}
            >
              <AdminTabIcon tab={t.id as AdminPanelTab} className="h-5 w-5 shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="admin-container">
        <main className="admin-main-content">
          {message && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3.5 shadow-sm border ${
                message.type === "ok"
                  ? "bg-zinc-50 text-zinc-800 border-zinc-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${message.type === "ok" ? "bg-zinc-900" : "bg-rose-500"}`} />
              {message.text}
            </div>
          )}

          {loading ? (
            <AdminTabSkeleton
              tab={tab}
              selectedGameId={selectedGameId}
              selectedModeId={selectedModeId}
            />
          ) : tabLoading && tab !== "dashboard" && !hasAdminTabCache(tab, selectedModeId) ? (
            <AdminTabSkeleton
              tab={tab}
              selectedGameId={selectedGameId}
              selectedModeId={selectedModeId}
            />
          ) : (
            <>
              {tab === "dashboard" && (
                <DashboardSection
                  stats={dashboardStats}
                  loading={tabLoading}
                  session={session}
                  onNavigate={(t) => goToTab(t as Tab)}
                  onRefresh={() => loadDashboardStats(true)}
                />
              )}
              
              {tab === "modes" && (
                selectedModeId ? (
                  <MatchesSection
                    games={games}
                    modes={modes}
                    matches={matches.filter((m) => m.gameModeId === selectedModeId)}
                    matchPresets={matchPresets.filter((p) => p.gameModeId === selectedModeId)}
                    modeId={selectedModeId}
                    users={users}
                    matchStatus={navParams.mstatus}
                    playersMatchId={navParams.match}
                    playersViewMode={navParams.mview}
                    onNavChange={(patch) => patchAdminNav(patch)}
                    onBack={() => {
                      setMatchBulkSelect(null);
                      patchAdminNav({ mode: null, match: null, mview: null, mstatus: null });
                    }}
                    onSuccess={(opts?: { silent?: boolean }) => { refreshCurrentTab(!opts?.silent); showMsg("ok", "Updated"); }}
                    onBulkSelectChange={setMatchBulkSelect}
                  />
                ) : selectedGameId ? (
                  <ModesSection
                    games={games}
                    modes={modes.filter((m) => m.gameId === selectedGameId)}
                    gameId={selectedGameId}
                    onBack={undefined}
                    onSelectMode={(id) => patchAdminNav({ mode: id, match: null, mview: null, mstatus: null })}
                    onSuccess={() => { refreshCurrentTab(); showMsg("ok", "Mode created"); }}
                  />
                ) : (
                  <GamesSection
                    games={games}
                    onSelectGame={(id) => patchAdminNav({ game: id, mode: null })}
                    onSuccess={() => { refreshCurrentTab(); showMsg("ok", "Game created"); }}
                    showCreateGame={!hasSpecificGameAccess}
                  />
                )
              )}
              
              {tab === "presets" && (
                <MatchPresetsSection
                  games={games}
                  modes={modes}
                  presets={matchPresets}
                  onSuccess={() => { refreshCurrentTab(); showMsg("ok", "Preset saved"); }}
                />
              )}
              
              {tab === "moneyorders" && (
                <MoneyOrdersSection
                  deposits={deposits}
                  users={users}
                  onSuccess={() => { refreshCurrentTab(false); showMsg("ok", "Deposits Updated"); }}
                />
              )}
              
              {tab === "withdrawals" && (
                <WithdrawalsSection
                  withdrawals={withdrawals}
                  users={users}
                  onSuccess={() => { refreshCurrentTab(false); showMsg("ok", "Withdrawals Updated"); }}
                />
              )}
              
              {tab === "admins" && session && canAccessAdminTab(session, "admins") && (
                <CreateAdminSection
                  onSuccess={() => { refreshCurrentTab(); showMsg("ok", "Admin created"); }}
                />
              )}
              
              {tab === "notifications" && (
                <PushNotificationsSection />
              )}
              
              {tab === "appsettings" && (
                <AppSettingsSection
                  onSuccess={() => { refreshCurrentTab(false); showMsg("ok", "Settings saved"); }}
                />
              )}

              {tab === "banners" && (
                <BannersSection />
              )}

              {tab === "referrals" && (
                <ReferralsSection />
              )}

              {tab === "users" && session && canAccessAdminTab(session, "users") && (
                <UsersSection
                  users={users}
                  canAddCoins={canAccessAdminTab(session, "moneyorders") || canAccessAdminTab(session, "withdrawals")}
                  onPatchUser={patchUserInList}
                  onUserRemoved={(userId) => {
                    setUsers((prev) => prev.filter((u) => u.id !== userId));
                    removeAdminClientCache(adminTabClientKey("users"));
                    loadedTabsRef.current.delete("users");
                    showMsg("ok", "User deleted");
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ItemMenu({
  onDelete,
  onRename,
  onChangeImage,
  currentName,
  stopPropagation = true,
}: {
  onDelete: () => void;
  onRename: (newName: string) => void;
  onChangeImage?: () => void;
  currentName: string;
  stopPropagation?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const handleRename = () => {
    setOpen(false);
    const newName = prompt("Enter new name", currentName);
    if (newName && newName.trim()) onRename(newName.trim());
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
        aria-label="Options"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-zinc-200 bg-zinc-50 py-1 shadow-xl">
          <button
            type="button"
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              handleRename();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Rename
          </button>
          {onChangeImage && (
            <button
              type="button"
              onClick={(e) => {
                if (stopPropagation) e.stopPropagation();
                setOpen(false);
                onChangeImage();
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Change image
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              setOpen(false);
              if (confirm("Delete this item?")) onDelete();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-400 hover:bg-zinc-100"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Upload failed");
  }
  const { url } = await res.json();
  return url;
}

const MATCH_TYPE_OPTIONS: { value: MatchType; label: string }[] = [
  { value: "solo", label: "Solo (1 player)" },
  { value: "duo", label: "Duo (2 players)" },
  { value: "squad", label: "Squad (4 players)" },
];

function MatchTypeDropdown({ value, onChange }: { value: MatchType; onChange: (v: MatchType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  const label = MATCH_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="admin-input flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-zinc-900 outline-none"
      >
        <span>{label}</span>
        <svg className={`h-5 w-5 text-zinc-500 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-zinc-200 bg-zinc-50 py-1 shadow-xl">
          {MATCH_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-zinc-700 hover:bg-zinc-100/80 ${opt.value === value ? "bg-zinc-100/50 text-zinc-900" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_RANK_REWARDS: RankReward[] = [
  { fromRank: 1, toRank: 1, coins: 0 },
  { fromRank: 2, toRank: 2, coins: 0 },
  { fromRank: 3, toRank: 3, coins: 0 },
];

function nextRankRange(prev: RankReward[]): RankReward {
  const maxTo = prev.length > 0 ? Math.max(...prev.map((r) => r.toRank)) : 0;
  return { fromRank: maxTo + 1, toRank: maxTo + 1, coins: 0 };
}

function RankRewardsEditor({
  value,
  onChange,
}: {
  value: RankReward[];
  onChange: (next: RankReward[]) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-zinc-500">Rank rewards (coins per rank range)</label>
      <p className="text-[11px] text-zinc-500">
        Add ranges like rank 5–10 with a prize for each player in that range. Use the same from/to for a single rank.
      </p>
      {value.length === 0 && (
        <p className="text-sm text-zinc-500">No rank ranges yet. Add one below.</p>
      )}
      {value.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="1"
            value={r.fromRank}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, fromRank: Number(e.target.value) || 1 } : x)))
            }
            className="admin-input w-16 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none"
            aria-label={`Range ${i + 1} from rank`}
          />
          <span className="text-zinc-500">-</span>
          <input
            type="number"
            min="1"
            value={r.toRank}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, toRank: Number(e.target.value) || 1 } : x)))
            }
            className="admin-input w-16 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none"
            aria-label={`Range ${i + 1} to rank`}
          />
          <span className="text-zinc-500">→</span>
          <input
            type="number"
            min="0"
            value={r.coins}
            onChange={(e) =>
              onChange(value.map((x, j) => (j === i ? { ...x, coins: Number(e.target.value) || 0 } : x)))
            }
            className="admin-input w-20 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none"
            placeholder="coins"
          />
          <span className="text-zinc-500 text-sm">coins</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20"
            aria-label="Remove range"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, nextRankRange(value)])}
        className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
      >
        + Add rank range
      </button>
    </div>
  );
}

function ImageUpload({
  file,
  previewUrl,
  onChange,
  onClear,
}: {
  file: File | null;
  previewUrl: string | null;
  onChange: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = `img-upload-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="space-y-2">
      <label className="mb-2 block text-sm font-medium text-zinc-600">Image (optional)</label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label
          htmlFor={inputId}
          className="admin-input flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition hover:border-zinc-400"
        >
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChange(f);
            }}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="mb-2 max-h-24 rounded-lg object-cover" />
          ) : (
            <svg className="mb-2 h-10 w-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
          <span className="text-sm text-zinc-500">
            {file ? file.name : "Click to upload or drag image"}
          </span>
        </label>
        {file && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg bg-zinc-100/50 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function GamesSection({
  games,
  onSelectGame,
  onSuccess,
  showCreateGame = true,
}: {
  games: Game[];
  onSelectGame: (id: string) => void;
  onSuccess: () => void;
  showCreateGame?: boolean;
}) {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageClear = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        try {
          imageUrl = await uploadImage(imageFile);
        } catch (uploadErr) {
          console.warn("Image upload failed, adding game without image:", uploadErr);
        }
      }
      const res = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, imageUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      handleImageClear();
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {showCreateGame && (
        <section className="admin-panel w-full">
          <h2 className="mb-1 text-base font-semibold text-zinc-900">Create Game</h2>
          <p className="mb-6 text-sm text-zinc-500">Add a new game to the platform</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-600">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                placeholder="e.g. BGMI"
              />
            </div>
            <ImageUpload
              file={imageFile}
              previewUrl={imagePreview}
              onChange={handleImageChange}
              onClear={handleImageClear}
            />
            <button
              type="submit"
              disabled={submitting}
              className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Game"}
            </button>
          </form>
        </section>
      )}
      <section className="admin-panel w-full">
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Existing Games</h2>
        <p className="mb-5 text-sm text-zinc-500">Click a game to manage modes and matches</p>
        <ul className="space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectGame(g.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelectGame(g.id)}
              className="admin-list-item flex cursor-pointer items-center justify-between gap-2 rounded-xl px-4 py-3.5 transition hover:border-zinc-300"
            >
              <span className="font-medium text-zinc-700">{g.name}</span>
              <ItemMenu
                currentName={g.name}
                onDelete={async () => {
                  try {
                    const res = await fetch(`/api/admin/games/${g.id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error(await res.text());
                    onSuccess();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Failed to delete game");
                  }
                }}
                onRename={async (newName) => {
                  try {
                    const res = await fetch(`/api/admin/games/${g.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: newName }),
                    });
                    if (!res.ok) throw new Error(await res.text());
                    onSuccess();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Failed to rename game");
                  }
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ModesSection({
  games,
  modes,
  gameId,
  onBack,
  onSelectMode,
  onSuccess,
}: {
  games: Game[];
  modes: GameMode[];
  gameId: string;
  onBack: (() => void) | undefined;
  onSelectMode: (id: string) => void;
  onSuccess: () => void;
}) {
  const [view, setView] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingImageModeId, setPendingImageModeId] = useState<string | null>(null);
  const modeImageInputRef = useRef<HTMLInputElement>(null);
  const gameName = games.find((g) => g.id === gameId)?.name ?? "Game";

  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageClear = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      const res = await fetch("/api/admin/modes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, name, imageUrl }),
      });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = "Failed to create mode";
        try {
          const errData = JSON.parse(text);
          if (errData?.error) errMsg = errData.error;
        } catch {
          if (text) errMsg = text;
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      if (!data?.id) throw new Error("Failed to create mode in database");
      setName("");
      handleImageClear();
      onSuccess();
      setView("list");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create mode");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMode = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/modes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete mode");
    }
  };

  const handleRenameMode = async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/admin/modes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename mode");
    }
  };

  const handleChangeModeImage = (modeId: string) => {
    setPendingImageModeId(modeId);
    modeImageInputRef.current?.click();
  };

  const handleModeImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const modeId = pendingImageModeId;
    e.target.value = "";
    setPendingImageModeId(null);
    if (!file || !modeId) return;

    try {
      const imageUrl = await uploadImage(file);
      const res = await fetch(`/api/admin/modes/${modeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = "Failed to update mode image";
        try {
          const errData = JSON.parse(text);
          if (errData?.error) errMsg = errData.error;
        } catch {
          if (text) errMsg = text;
        }
        throw new Error(errMsg);
      }
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update mode image");
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={modeImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleModeImageSelected}
      />
      {view === "list" ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition"
                  title="Back to Games"
                >
                  ←
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-1">Modes for {gameName}</h1>
                <p className="text-zinc-500 text-sm">Select a game mode to view and manage matches.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("create")}
              className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold shrink-0"
            >
              + Create Game Mode
            </button>
          </div>

          <div className="admin-panel w-full">
            <h3 className="mb-4 text-base font-semibold text-zinc-900">Existing Modes</h3>
            {modes.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No game modes configured yet</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modes.map((m) => (
                  <li
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectMode(m.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectMode(m.id)}
                    className="admin-list-item flex cursor-pointer items-center justify-between gap-3 rounded-xl p-4 transition hover:border-zinc-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.imageUrl ? (
                        <img
                          src={m.imageUrl}
                          alt={m.name}
                          className="w-12 h-12 object-cover rounded-lg border border-zinc-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-500 text-lg shrink-0">
                          🎮
                        </div>
                      )}
                      <span className="font-semibold text-zinc-700 text-sm truncate">{m.name}</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ItemMenu
                        currentName={m.name}
                        onDelete={() => handleDeleteMode(m.id)}
                        onRename={(newName) => handleRenameMode(m.id, newName)}
                        onChangeImage={() => handleChangeModeImage(m.id)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to Modes
          </button>
          
          <section className="admin-form-section w-full">
            <h2 className="mb-1 text-lg font-bold text-zinc-900">Create Game Mode</h2>
            <p className="mb-6 text-sm text-zinc-500">Define a new game mode block under {gameName}.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Mode Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  placeholder="e.g. Ranked, Classic"
                />
              </div>
              <ImageUpload
                file={imageFile}
                previewUrl={imagePreview}
                onChange={handleImageChange}
                onClear={handleImageClear}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Mode"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl px-6 py-3 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

type ParticipantWithStats = {
  id: string;
  userId: string;
  slotIndex?: number;
  teamMembers: { inGameName: string; inGameUid: string; kills?: number }[];
  rank?: number;
};
type MatchWithParticipants = Match & { participants?: ParticipantWithStats[] };

const PRESET_PREVIEW_PAGE = 10;

function PresetSchedulePreviewList({ times }: { times: Date[] }) {
  const [visibleCount, setVisibleCount] = useState(PRESET_PREVIEW_PAGE);
  const visible = times.slice(0, visibleCount);
  const hasMore = times.length > visibleCount;
  const canSeeLess = visibleCount > PRESET_PREVIEW_PAGE;

  return (
    <div className="space-y-1">
      {visible.map((t, i) => (
        <p key={`${t.getTime()}-${i}`} className="text-sm text-zinc-500">
          {formatMatchDateTime(t)}
        </p>
      ))}
      {(hasMore || canSeeLess) && (
        <div className="pt-1">
          {hasMore ? (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.min(c + PRESET_PREVIEW_PAGE, times.length))}
              className="text-xs font-semibold text-zinc-900 hover:text-zinc-700"
            >
              See more
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVisibleCount(PRESET_PREVIEW_PAGE)}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-600"
            >
              See less
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MatchesSection({
  games,
  modes,
  matches,
  matchPresets,
  modeId,
  users,
  matchStatus,
  playersMatchId,
  playersViewMode,
  onNavChange,
  onBack,
  onSuccess,
  onBulkSelectChange,
}: {
  games: Game[];
  modes: GameMode[];
  matches: Match[];
  matchPresets: MatchPreset[];
  modeId: string;
  users: User[];
  matchStatus: AdminMatchStatus;
  playersMatchId: string | null;
  playersViewMode: AdminMatchView;
  onNavChange: (patch: {
    mstatus?: AdminMatchStatus | null;
    match?: string | null;
    mview?: AdminMatchView | null;
  }) => void;
  onBack: () => void;
  onSuccess: (opts?: { silent?: boolean }) => void;
  onBulkSelectChange?: (controls: MatchBulkSelectControls | null) => void;
}) {
  const [view, setView] = useState<"list" | "create" | "createFromPreset" | "edit">("list");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("16");
  const [scheduledAt, setScheduledAt] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("solo");
  const [coinsPerKill, setCoinsPerKill] = useState("5");
  const [totalPrizePool, setTotalPrizePool] = useState("");
  const [rankRewards, setRankRewards] = useState<RankReward[]>(DEFAULT_RANK_REWARDS);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const matchTab = matchStatus;
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetMatchDate, setPresetMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [presetStartingTime, setPresetStartingTime] = useState("10:00");
  const [presetGapMinutes, setPresetGapMinutes] = useState("60");
  const [presetEndingTime, setPresetEndingTime] = useState("18:00");
  const [presetSubmitting, setPresetSubmitting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [startMatchTarget, setStartMatchTarget] = useState<Match | null>(null);
  const [startRoomCode, setStartRoomCode] = useState("");
  const [startRoomPassword, setStartRoomPassword] = useState("");
  const [startingMatch, setStartingMatch] = useState(false);
  const [editRoomTarget, setEditRoomTarget] = useState<Match | null>(null);
  const [editRoomCode, setEditRoomCode] = useState("");
  const [editRoomPassword, setEditRoomPassword] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);

  const presetSchedulePreview =
    selectedPresetId && presetMatchDate && presetStartingTime && presetEndingTime && Number(presetGapMinutes) > 0
      ? buildMatchScheduleTimes(
          presetMatchDate,
          presetStartingTime,
          Number(presetGapMinutes),
          presetEndingTime,
        )
      : [];

  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageClear = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const mode = modes.find((m) => m.id === modeId);
  const gameName = mode ? games.find((g) => g.id === mode.gameId)?.name ?? "?" : "?";
  const modeName = mode?.name ?? "?";

  const upcoming = matches.filter((m) => m.status === "upcoming");
  const ongoing = matches.filter((m) => m.status === "ongoing");
  const finished = matches.filter((m) => m.status === "ended" || m.status === "completed");
  const tabMatches = matchTab === "upcoming" ? upcoming : matchTab === "ongoing" ? ongoing : finished;
  const selectableMatches = matchTab === "upcoming" ? upcoming : [];
  const selectableMatchIds = useMemo(() => selectableMatches.map((m) => m.id), [selectableMatches]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedMatchIds(new Set());
  }, []);

  const toggleMatchSelection = useCallback((matchId: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((matchId: string) => {
    setSelectionMode(true);
    setSelectedMatchIds(new Set([matchId]));
    onNavChange({ match: null, mview: null });
    setExpandedMatchId(null);
  }, []);

  useEffect(() => {
    if (!selectionMode) {
      onBulkSelectChange?.(null);
      return;
    }
    onBulkSelectChange?.({
      selectedCount: selectedMatchIds.size,
      totalSelectable: selectableMatchIds.length,
      selectAll: () => setSelectedMatchIds(new Set(selectableMatchIds)),
      exitSelection: exitSelectionMode,
    });
  }, [selectionMode, selectedMatchIds.size, selectableMatchIds, onBulkSelectChange, exitSelectionMode]);

  useEffect(() => {
    return () => onBulkSelectChange?.(null);
  }, [onBulkSelectChange]);

  useEffect(() => {
    if (matchTab !== "upcoming" && selectionMode) {
      exitSelectionMode();
    }
  }, [matchTab, selectionMode, exitSelectionMode]);

  const handleMatchCardClick = (matchId: string, canSelect: boolean) => {
    if (selectionMode && canSelect) {
      toggleMatchSelection(matchId);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedMatchIds.size === 0) return;
    if (
      !confirm(
        `Cancel ${selectedMatchIds.size} match${selectedMatchIds.size === 1 ? "" : "es"}? All registered players will receive a refund.`,
      )
    ) {
      return;
    }
    setBulkCancelling(true);
    let successCount = 0;
    let failureCount = 0;
    for (const id of Array.from(selectedMatchIds)) {
      try {
        const res = await fetch(`/api/admin/matches/${id}/cancel`, { method: "POST" });
        if (res.ok) successCount += 1;
        else failureCount += 1;
      } catch {
        failureCount += 1;
      }
    }
    setBulkCancelling(false);
    exitSelectionMode();
    onSuccess({ silent: true });
    alert(
      `Cancelled ${successCount} match${successCount === 1 ? "" : "es"}` +
        (failureCount ? ` (${failureCount} failed)` : "") +
        ".",
    );
  };

  const getMatchBanner = (m: Match) => {
    if (m.image) {
      if (m.image.startsWith("http") || m.image.startsWith("/")) {
        return m.image;
      }
      if (m.image.includes("poster_1") || m.image.includes("poster1")) return "/images/ff_image.jpg";
      if (m.image.includes("poster_2") || m.image.includes("poster2")) return "/images/bgmi_image.jpg";
      if (m.image.includes("poster_3") || m.image.includes("poster3")) return "/images/cod_image.jpg";
    }
    const t = m.title.toLowerCase();
    if (t.includes("duo")) return "/images/bgmi_image.jpg";
    if (t.includes("squad")) return "/images/cod_image.jpg";
    return "/images/ff_image.jpg";
  };

  const toDatetimeLocalValue = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const populateMatchForm = (m: Match) => {
    setTitle(m.title);
    setEntryFee(String(m.entryFee));
    setMaxParticipants(String(m.maxParticipants ?? 16));
    setMatchType(m.matchType ?? "solo");
    setCoinsPerKill(String(m.prizePool?.coinsPerKill ?? 5));
    setTotalPrizePool(m.prizePool?.totalPrizePool != null ? String(m.prizePool.totalPrizePool) : "");
    setRankRewards(m.prizePool?.rankRewards?.length ? m.prizePool.rankRewards : [...DEFAULT_RANK_REWARDS]);
    setScheduledAt(toDatetimeLocalValue(m.scheduledAt));
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(getMatchBanner(m));
    setEditingMatchId(m.id);
  };

  const resetMatchForm = () => {
    setTitle("");
    setEntryFee("");
    setMaxParticipants("16");
    setScheduledAt("");
    setMatchType("solo");
    setCoinsPerKill("5");
    setTotalPrizePool("");
    setRankRewards([...DEFAULT_RANK_REWARDS]);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setEditingMatchId(null);
  };

  const handleDeleteMatch = async (m: Match) => {
    const spots = m.participantCount ?? 0;
    if (m.status === "upcoming" && spots > 0) {
      if (
        !confirm(
          `Cancel "${m.title}" and refund ${spots} registered player${spots === 1 ? "" : "s"}?`,
        )
      ) {
        return;
      }
      const res = await fetch(`/api/admin/matches/${m.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        alert("Failed to cancel match");
        return;
      }
    } else {
      if (!confirm(`Delete "${m.title}" permanently? This cannot be undone.`)) return;
      const res = await fetch(`/api/admin/matches/${m.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData?.error || "Failed to delete match");
        return;
      }
    }
    if (playersMatchId === m.id) onNavChange({ match: null, mview: null });
    onSuccess({ silent: true });
  };

  const handleOpenEditMatch = (m: Match) => {
    populateMatchForm(m);
    setView("edit");
    onNavChange({ match: null, mview: null });
  };

  const openStartMatchModal = (m: Match) => {
    setStartMatchTarget(m);
    setStartRoomCode(m.roomCode ?? "");
    setStartRoomPassword(m.roomPassword ?? "");
  };

  const closeStartMatchModal = () => {
    if (startingMatch) return;
    setStartMatchTarget(null);
    setStartRoomCode("");
    setStartRoomPassword("");
  };

  const handleStartMatchFromModal = async () => {
    if (!startMatchTarget) return;
    if (!startRoomCode.trim() || !startRoomPassword.trim()) {
      alert("Please enter room ID and password");
      return;
    }
    setStartingMatch(true);
    try {
      const res = await fetch(`/api/admin/matches/${startMatchTarget.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: startRoomCode.trim(),
          roomPassword: startRoomPassword.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start match");
      }
      setStartMatchTarget(null);
      setStartRoomCode("");
      setStartRoomPassword("");
      onNavChange({ mstatus: "ongoing", match: null, mview: null });
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start match");
    } finally {
      setStartingMatch(false);
    }
  };

  const openEditRoomModal = (m: Match) => {
    setEditRoomTarget(m);
    setEditRoomCode(m.roomCode ?? "");
    setEditRoomPassword(m.roomPassword ?? "");
  };

  const closeEditRoomModal = () => {
    if (savingRoom) return;
    setEditRoomTarget(null);
    setEditRoomCode("");
    setEditRoomPassword("");
  };

  const handleSaveRoomInfo = async () => {
    if (!editRoomTarget) return;
    if (!editRoomCode.trim() || !editRoomPassword.trim()) {
      alert("Please enter room ID and password");
      return;
    }
    setSavingRoom(true);
    try {
      const res = await fetch(`/api/admin/matches/${editRoomTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: editRoomCode.trim(),
          roomPassword: editRoomPassword.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditRoomTarget(null);
      setEditRoomCode("");
      setEditRoomPassword("");
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save room info");
    } finally {
      setSavingRoom(false);
    }
  };

  const handleCancelOngoingMatch = async (m: Match) => {
    const spots = m.participantCount ?? 0;
    const refundNote =
      spots > 0
        ? ` All ${spots} registered player${spots === 1 ? "" : "s"} will receive a refund.`
        : "";
    if (!confirm(`Cancel "${m.title}"?${refundNote}`)) return;
    try {
      const res = await fetch(`/api/admin/matches/${m.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      if (playersMatchId === m.id) onNavChange({ match: null, mview: null });
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel match");
    }
  };

  const openPlayersView = (
    matchId: string,
    mode: "manage" | "leaderboard" | "registered",
  ) => {
    onNavChange({ match: matchId, mview: mode });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxErr = validateMaxParticipants(matchType, Number(maxParticipants) || 16);
    if (maxErr) {
      alert(maxErr);
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const payload = {
        title,
        entryFee: Number(entryFee),
        maxParticipants: Number(maxParticipants) || 16,
        scheduledAt: scheduledAt || new Date().toISOString(),
        matchType,
        prizePool: {
          coinsPerKill: Number(coinsPerKill) || 0,
          totalPrizePool: totalPrizePool ? Number(totalPrizePool) : 0,
          rankRewards: rankRewards.filter((r) => r.fromRank > 0 && r.toRank >= r.fromRank && r.coins >= 0),
        },
        ...(imageUrl !== undefined ? { image: imageUrl } : {}),
      };

      if (view === "edit" && editingMatchId) {
        const res = await fetch(`/api/admin/matches/${editingMatchId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          let errMsg = "Failed to update match";
          try {
            const errData = JSON.parse(text);
            if (errData?.error) errMsg = errData.error;
          } catch {
            if (text) errMsg = text;
          }
          throw new Error(errMsg);
        }
        resetMatchForm();
        setView("list");
        onSuccess({ silent: true });
        return;
      }

      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameModeId: modeId,
          ...payload,
          image: imageUrl,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = "Failed to create match";
        try {
          const errData = JSON.parse(text);
          if (errData?.error) errMsg = errData.error;
        } catch {
          if (text) errMsg = text;
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setTitle("");
      setEntryFee("");
      setMaxParticipants("16");
      setScheduledAt("");
      setMatchType("solo");
      setCoinsPerKill("5");
      setTotalPrizePool("");
      setRankRewards([...DEFAULT_RANK_REWARDS]);
      handleImageClear();
      onNavChange({ mstatus: "upcoming", match: null, mview: null });
      setView("list");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create match");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFromPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPresetId) {
      alert("Select a preset");
      return;
    }
    setPresetSubmitting(true);
    try {
      const res = await fetch("/api/admin/matches/from-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: selectedPresetId,
          gameModeId: modeId,
          matchDate: presetMatchDate,
          startingTime: presetStartingTime,
          gapMinutes: Number(presetGapMinutes),
          endingTime: presetEndingTime,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to create matches");
      }
      const data = await res.json();
      setView("list");
      onNavChange({ mstatus: "upcoming", match: null, mview: null });
      onSuccess({ silent: true });
      alert(`Created ${data.count} match${data.count === 1 ? "" : "es"}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create matches");
    } finally {
      setPresetSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {view === "list" ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition"
                title="Back to Game Modes"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 mb-1">Matches for {modeName}</h1>
                <p className="text-zinc-500 text-sm">Review players registration, details and map parameters.</p>
              </div>
            </div>
            {!playersMatchId && !selectionMode && (
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setView("create")}
                  className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  + Create New Match
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(matchPresets[0]?.id ?? "");
                    setView("createFromPreset");
                  }}
                  disabled={matchPresets.length === 0}
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create using preset
                </button>
              </div>
            )}
          </div>

          <div className="admin-match-list space-y-6">
            {playersMatchId ? (
              <MatchDetailView
                matchId={playersMatchId}
                games={games}
                modes={modes}
                users={users}
                playersOnly
                readOnly={playersViewMode === "leaderboard"}
                leaderboardMode={playersViewMode === "leaderboard"}
                onBack={() => onNavChange({ match: null, mview: null })}
                onSuccess={onSuccess}
              />
            ) : (
              <>
                <div className="mb-6 grid w-full grid-cols-3 gap-2 sm:flex">
                  {(["upcoming", "ongoing", "finished"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onNavChange({ mstatus: t, match: null, mview: null });
                        exitSelectionMode();
                      }}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold sm:px-5 sm:text-sm ${
                        matchTab === t
                          ? "admin-btn-primary text-zinc-900"
                          : "bg-zinc-50/80 text-zinc-500 hover:bg-zinc-100 border border-zinc-200/60"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {tabMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center text-zinc-500 bg-zinc-100/20">
                    No {matchTab} matches recorded under this mode.
                  </div>
                ) : (
                  <>
                    {selectionMode && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleBulkCancel}
                          disabled={bulkCancelling || selectedMatchIds.size === 0}
                          className="rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-zinc-900 transition"
                        >
                          {bulkCancelling
                            ? "Cancelling..."
                            : selectedMatchIds.size > 0
                              ? `Cancel ${selectedMatchIds.size} Match${selectedMatchIds.size === 1 ? "" : "es"}`
                              : "Cancel Selected"}
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tabMatches.map((m) => {
                      const isSelected = selectedMatchIds.has(m.id);
                      const canSelect = matchTab === "upcoming" && m.status === "upcoming";
                      return (
                        <AdminMatchCard
                          key={m.id}
                          item={{
                            id: m.id,
                            title: m.title,
                            entryFee: m.entryFee,
                            maxParticipants: m.maxParticipants ?? 100,
                            matchType: m.matchType,
                            prizePool: m.prizePool,
                            image: m.image,
                            map: m.map,
                            scheduledAt: m.scheduledAt,
                            participantCount: m.participantCount,
                          }}
                          isSelected={isSelected}
                          selectionMode={selectionMode}
                          canSelect={canSelect}
                          onCardClick={() => handleMatchCardClick(m.id, canSelect)}
                          onContextMenu={(e) => {
                            if (!canSelect) return;
                            e.preventDefault();
                            enterSelectionMode(m.id);
                          }}
                          onLongPress={
                            canSelect && !selectionMode
                              ? () => enterSelectionMode(m.id)
                              : undefined
                          }
                          onStart={
                            matchTab === "upcoming" && m.status === "upcoming"
                              ? () => openStartMatchModal(m)
                              : undefined
                          }
                          onSeePlayers={
                            matchTab === "upcoming" && m.status === "upcoming"
                              ? () => openPlayersView(m.id, "registered")
                              : undefined
                          }
                          onManage={
                            matchTab === "ongoing" && m.status === "ongoing"
                              ? () => openPlayersView(m.id, "manage")
                              : undefined
                          }
                          onEditRoom={
                            matchTab === "ongoing" && m.status === "ongoing"
                              ? () => openEditRoomModal(m)
                              : undefined
                          }
                          onCancelMatch={
                            matchTab === "ongoing" && m.status === "ongoing"
                              ? () => handleCancelOngoingMatch(m)
                              : undefined
                          }
                          onSeeLeaderboard={
                            matchTab === "finished"
                              ? () => openPlayersView(m.id, "leaderboard")
                              : undefined
                          }
                          onEdit={m.status === "upcoming" ? () => handleOpenEditMatch(m) : undefined}
                          onDelete={
                            m.status === "upcoming" ? () => handleDeleteMatch(m) : undefined
                          }
                        />
                      );
                    })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      ) : view === "createFromPreset" ? (
        <>
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to Matches List
          </button>

          <section className="admin-form-section w-full">
            <h2 className="mb-1 text-lg font-bold text-zinc-900">Create Matches from Preset</h2>
            <p className="mb-6 text-sm text-zinc-500">
              Select a preset and schedule multiple matches for {modeName} on one day.
            </p>

            {matchPresets.length === 0 ? (
              <p className="text-zinc-500 text-sm">
                No presets for this mode yet. Create one in the Match Presets tab first.
              </p>
            ) : (
              <form onSubmit={handleCreateFromPreset} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-600">Preset</label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  >
                    <option value="">Select preset...</option>
                    {matchPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.title} ({p.entryFee} coins, {p.matchType ?? "solo"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-600">Match date</label>
                  <input
                    type="date"
                    value={presetMatchDate}
                    onChange={(e) => setPresetMatchDate(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-600">Starting time</label>
                    <input
                      type="time"
                      value={presetStartingTime}
                      onChange={(e) => setPresetStartingTime(e.target.value)}
                      required
                      className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-600">Time gap (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      value={presetGapMinutes}
                      onChange={(e) => setPresetGapMinutes(e.target.value)}
                      required
                      className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-600">Ending time</label>
                    <input
                      type="time"
                      value={presetEndingTime}
                      onChange={(e) => setPresetEndingTime(e.target.value)}
                      required
                      className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                    />
                  </div>
                </div>
                {presetSchedulePreview.length > 0 && (
                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/20 p-4">
                    <p className="text-sm font-medium text-zinc-600 mb-2">
                      {presetSchedulePreview.length} match{presetSchedulePreview.length === 1 ? "" : "es"} will be created at:
                    </p>
                    <PresetSchedulePreviewList times={presetSchedulePreview} />
                  </div>
                )}
                {selectedPresetId && presetSchedulePreview.length === 0 && (
                  <p className="text-sm text-amber-400/90">
                    No valid slots with this schedule. Ending time must be after starting time.
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={presetSubmitting || presetSchedulePreview.length === 0}
                    className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
                  >
                    {presetSubmitting ? "Creating..." : `Create ${presetSchedulePreview.length || ""} Matches`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl px-6 py-3 font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      ) : view === "create" || view === "edit" ? (
        <>
          <button
            type="button"
            onClick={() => {
              resetMatchForm();
              setView("list");
            }}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to Matches List
          </button>

          <section className="admin-form-section w-full">
            <h2 className="mb-1 text-lg font-bold text-zinc-900">
              {view === "edit" ? "Edit Match" : "Create New Match"}
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              {view === "edit"
                ? "Update match details for upcoming matches under " + modeName + "."
                : "Setup matches and reward parameters under " + modeName + "."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  placeholder="e.g. Weekend Cup #1"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Match Type</label>
                <MatchTypeDropdown value={matchType} onChange={setMatchType} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-600">Entry Fee (coins)</label>
                  <input
                    type="number"
                    min="0"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-600">Max Participants</label>
                  <input
                    type="number"
                    min="2"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Scheduled At (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                />
              </div>
              <ImageUpload
                file={imageFile}
                previewUrl={imagePreview}
                onChange={handleImageChange}
                onClear={handleImageClear}
              />
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/10 p-5">
                <h3 className="mb-3 text-sm font-semibold text-zinc-600">Prize Pool</h3>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Total prize pool (coins)</label>
                    <input
                      type="number"
                      min="0"
                      value={totalPrizePool}
                      onChange={(e) => setTotalPrizePool(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-zinc-900 outline-none"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Coins per kill</label>
                    <input
                      type="number"
                      min="0"
                      value={coinsPerKill}
                      onChange={(e) => setCoinsPerKill(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-zinc-900 outline-none"
                      placeholder="5"
                    />
                  </div>
                </div>
                <RankRewardsEditor value={rankRewards} onChange={setRankRewards} />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
                >
                  {submitting
                    ? view === "edit"
                      ? "Saving..."
                      : "Creating..."
                    : view === "edit"
                      ? "Save Changes"
                      : "Create Match"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMatchForm();
                    setView("list");
                  }}
                  className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl px-6 py-3 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}

      {startMatchTarget && (
        <StartMatchModal
          matchTitle={startMatchTarget.title}
          roomCode={startRoomCode}
          roomPassword={startRoomPassword}
          onRoomCodeChange={setStartRoomCode}
          onRoomPasswordChange={setStartRoomPassword}
          onClose={closeStartMatchModal}
          onStart={handleStartMatchFromModal}
          starting={startingMatch}
        />
      )}

      {editRoomTarget && (
        <EditRoomModal
          matchTitle={editRoomTarget.title}
          roomCode={editRoomCode}
          roomPassword={editRoomPassword}
          onRoomCodeChange={setEditRoomCode}
          onRoomPasswordChange={setEditRoomPassword}
          onClose={closeEditRoomModal}
          onSave={handleSaveRoomInfo}
          saving={savingRoom}
        />
      )}
    </div>
  );
}

function EditRoomModal({
  matchTitle,
  roomCode,
  roomPassword,
  onRoomCodeChange,
  onRoomPasswordChange,
  onClose,
  onSave,
  saving,
}: {
  matchTitle: string;
  roomCode: string;
  roomPassword: string;
  onRoomCodeChange: (v: string) => void;
  onRoomPasswordChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, saving]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
        aria-hidden
      />
      <div
        ref={ref}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900">Edit Room Info</h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{matchTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Room ID</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value)}
              className="admin-input w-full rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none"
              placeholder="ROOM123"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Password</label>
            <input
              type="text"
              value={roomPassword}
              onChange={(e) => onRoomPasswordChange(e.target.value)}
              className="admin-input w-full rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none"
              placeholder="pass123"
            />
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !roomCode.trim() || !roomPassword.trim()}
            className="w-full rounded-xl admin-btn-primary py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Room Info"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StartMatchModal({
  matchTitle,
  roomCode,
  roomPassword,
  onRoomCodeChange,
  onRoomPasswordChange,
  onClose,
  onStart,
  starting,
}: {
  matchTitle: string;
  roomCode: string;
  roomPassword: string;
  onRoomCodeChange: (v: string) => void;
  onRoomPasswordChange: (v: string) => void;
  onClose: () => void;
  onStart: () => void;
  starting: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !starting) onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, starting]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !starting && onClose()}
        aria-hidden
      />
      <div
        ref={ref}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900">Start Match</h2>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{matchTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={starting}
            className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <p className="text-xs text-zinc-500">
            Enter room details. Joined players will receive the room ID and password via push notification.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Room ID</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value)}
              className="admin-input w-full rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none"
              placeholder="ROOM123"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-600">Password</label>
            <input
              type="text"
              value={roomPassword}
              onChange={(e) => onRoomPasswordChange(e.target.value)}
              className="admin-input w-full rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none"
              placeholder="pass123"
            />
          </div>
          <button
            type="button"
            onClick={onStart}
            disabled={starting || !roomCode.trim() || !roomPassword.trim()}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting..." : "Start Match"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchPresetsSection({
  games,
  modes,
  presets,
  onSuccess,
}: {
  games: Game[];
  modes: GameMode[];
  presets: MatchPreset[];
  onSuccess: () => void;
}) {
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [filterGameId, setFilterGameId] = useState(games[0]?.id ?? "");
  const [filterModeId, setFilterModeId] = useState("");
  const [gameModeId, setGameModeId] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("16");
  const [matchType, setMatchType] = useState<MatchType>("solo");
  const [map, setMap] = useState("BERMUDA");
  const [coinsPerKill, setCoinsPerKill] = useState("5");
  const [totalPrizePool, setTotalPrizePool] = useState("");
  const [rankRewards, setRankRewards] = useState<RankReward[]>(DEFAULT_RANK_REWARDS);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredModes = modes.filter((m) => !filterGameId || m.gameId === filterGameId);
  const visiblePresets = presets.filter((p) => {
    if (filterModeId) return p.gameModeId === filterModeId;
    if (filterGameId) {
      const modeIds = modes.filter((m) => m.gameId === filterGameId).map((m) => m.id);
      return modeIds.includes(p.gameModeId);
    }
    return true;
  });

  const modeLabel = (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId);
    if (!mode) return modeId;
    const game = games.find((g) => g.id === mode.gameId);
    return `${game?.name ?? "?"} / ${mode.name}`;
  };

  const searchTrimmed = searchQuery.trim().toLowerCase();
  const filteredPresets = visiblePresets.filter((p) => {
    if (!searchTrimmed) return true;
    return (
      p.name.toLowerCase().includes(searchTrimmed) ||
      p.title.toLowerCase().includes(searchTrimmed) ||
      modeLabel(p.gameModeId).toLowerCase().includes(searchTrimmed)
    );
  });

  const resetForm = () => {
    setName("");
    setTitle("");
    setEntryFee("");
    setMaxParticipants("16");
    setMatchType("solo");
    setMap("BERMUDA");
    setCoinsPerKill("5");
    setTotalPrizePool("");
    setRankRewards([...DEFAULT_RANK_REWARDS]);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setEditingPresetId(null);
  };

  const populatePresetForm = (p: MatchPreset) => {
    setGameModeId(p.gameModeId);
    setName(p.name);
    setTitle(p.title);
    setEntryFee(String(p.entryFee));
    setMaxParticipants(String(p.maxParticipants));
    setMatchType(p.matchType ?? "solo");
    setMap(p.map ?? "BERMUDA");
    setCoinsPerKill(String(p.prizePool?.coinsPerKill ?? 5));
    setTotalPrizePool(p.prizePool?.totalPrizePool != null ? String(p.prizePool.totalPrizePool) : "");
    setRankRewards(p.prizePool?.rankRewards?.length ? p.prizePool.rankRewards : [...DEFAULT_RANK_REWARDS]);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(getPresetBanner(p));
    setEditingPresetId(p.id);
  };

  const getPresetBanner = (p: MatchPreset) => {
    if (p.image && (p.image.startsWith("http") || p.image.startsWith("/"))) return p.image;
    const t = p.title.toLowerCase();
    if (t.includes("duo")) return "/images/bgmi_image.jpg";
    if (t.includes("squad")) return "/images/cod_image.jpg";
    return "/images/ff_image.jpg";
  };

  const handleImageChange = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageClear = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameModeId) {
      alert("Select a game mode");
      return;
    }
    const maxErr = validateMaxParticipants(matchType, Number(maxParticipants) || 16);
    if (maxErr) {
      alert(maxErr);
      return;
    }
    setSubmitting(true);
    try {
      let imageUrl: string | null | undefined = undefined;
      if (imageFile) imageUrl = await uploadImage(imageFile);

      const payload = {
        gameModeId,
        name,
        title,
        entryFee: Number(entryFee),
        maxParticipants: Number(maxParticipants) || 16,
        matchType,
        map,
        prizePool: {
          coinsPerKill: Number(coinsPerKill) || 0,
          totalPrizePool: totalPrizePool ? Number(totalPrizePool) : 0,
          rankRewards: rankRewards.filter((r) => r.fromRank > 0 && r.toRank >= r.fromRank && r.coins >= 0),
        },
        ...(imageUrl !== undefined ? { image: imageUrl } : {}),
      };

      if (view === "edit" && editingPresetId) {
        const res = await fetch(`/api/admin/match-presets/${editingPresetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "Failed to update preset");
        }
        resetForm();
        setView("list");
        onSuccess();
        return;
      }

      const res = await fetch("/api/admin/match-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || "Failed to create preset");
      }
      resetForm();
      setView("list");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create preset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this preset?")) return;
    const res = await fetch(`/api/admin/match-presets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      alert(errData?.error || "Failed to delete preset");
      return;
    }
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Match Presets</h1>
          <p className="text-zinc-500 text-sm">Save match templates without date or time for bulk scheduling.</p>
        </div>
        {view === "list" && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setGameModeId(filterModeId || filteredModes[0]?.id || "");
              setView("create");
            }}
            className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold shrink-0"
          >
            + Create Preset
          </button>
        )}
      </div>

      {view === "list" ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <select
                value={filterGameId}
                onChange={(e) => {
                  setFilterGameId(e.target.value);
                  setFilterModeId("");
                }}
                className="admin-input rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none"
              >
                <option value="">All games</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <select
                value={filterModeId}
                onChange={(e) => setFilterModeId(e.target.value)}
                className="admin-input rounded-xl px-4 py-2.5 text-sm text-zinc-900 outline-none"
              >
                <option value="">All modes</option>
                {filteredModes.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Search by preset, title, or mode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input rounded-xl px-4 py-2.5 text-sm w-full lg:w-72 outline-none"
            />
          </div>

          <section className="w-full">
            {filteredPresets.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">
                {visiblePresets.length === 0
                  ? "No presets yet. Create one to schedule matches faster."
                  : "No presets match your search."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPresets.map((p) => (
                  <AdminMatchCard
                    key={p.id}
                    item={{
                      id: p.id,
                      title: p.title,
                      entryFee: p.entryFee,
                      maxParticipants: p.maxParticipants,
                      matchType: p.matchType,
                      prizePool: p.prizePool,
                      image: p.image,
                      map: p.map,
                      infoLine: `Preset: ${p.name}`,
                      metaLine: modeLabel(p.gameModeId),
                    }}
                    showProgress={false}
                    onEdit={() => {
                      populatePresetForm(p);
                      setView("edit");
                    }}
                    onDelete={() => handleDelete(p.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setView("list");
            }}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to presets
          </button>
          <section className="admin-form-section w-full">
            <h2 className="mb-1 text-lg font-bold text-zinc-900">
              {view === "edit" ? "Edit Match Preset" : "Create Match Preset"}
            </h2>
            <p className="mb-6 text-sm text-zinc-500">
              {view === "edit"
                ? "Update this saved template."
                : "All match details except date and time."}
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Game mode</label>
                <select
                  value={gameModeId}
                  onChange={(e) => setGameModeId(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                >
                  <option value="">Select mode...</option>
                  {modes.map((m) => {
                    const game = games.find((g) => g.id === m.gameId);
                    return (
                      <option key={m.id} value={m.id}>
                        {game?.name ?? "?"} / {m.name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Preset name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  placeholder="e.g. Morning Solo batch"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Match title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  placeholder="e.g. Daily Cup"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Match Type</label>
                <MatchTypeDropdown value={matchType} onChange={setMatchType} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-600">Entry Fee (coins)</label>
                  <input
                    type="number"
                    min="0"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-600">Max Participants</label>
                  <input
                    type="number"
                    min="2"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Map</label>
                <input
                  type="text"
                  value={map}
                  onChange={(e) => setMap(e.target.value)}
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                  placeholder="BERMUDA"
                />
              </div>
              <ImageUpload
                file={imageFile}
                previewUrl={imagePreview}
                onChange={handleImageChange}
                onClear={handleImageClear}
              />
              <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/10 p-5">
                <h3 className="mb-3 text-sm font-semibold text-zinc-600">Prize Pool</h3>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Total prize pool (coins)</label>
                    <input
                      type="number"
                      min="0"
                      value={totalPrizePool}
                      onChange={(e) => setTotalPrizePool(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-zinc-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Coins per kill</label>
                    <input
                      type="number"
                      min="0"
                      value={coinsPerKill}
                      onChange={(e) => setCoinsPerKill(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-zinc-900 outline-none"
                    />
                  </div>
                </div>
                <RankRewardsEditor value={rankRewards} onChange={setRankRewards} />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : view === "edit"
                      ? "Save Changes"
                      : "Save Preset"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setView("list");
                  }}
                  className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl px-6 py-3 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

function MatchDetailView({
  matchId,
  games,
  modes,
  users,
  onBack,
  onSuccess,
  playersOnly = false,
  readOnly = false,
  leaderboardMode = false,
}: {
  matchId: string;
  games: Game[];
  modes: GameMode[];
  users: User[];
  onBack: () => void;
  onSuccess: (opts?: { silent?: boolean }) => void;
  playersOnly?: boolean;
  readOnly?: boolean;
  leaderboardMode?: boolean;
}) {
  const [match, setMatch] = useState<MatchWithParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [localKills, setLocalKills] = useState<Record<string, string>>({});
  const [localRank, setLocalRank] = useState<Record<string, string>>({});
  const [subView, setSubView] = useState<"overview" | "players">(playersOnly ? "players" : "overview");
  const [formInitialized, setFormInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFormInitialized(false);
    fetch(`/api/admin/matches/${matchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setMatch(data);
        }
      })
      .catch(() => setMatch(null))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  useEffect(() => {
    if (!match?.participants || formInitialized) return;
    const showStoredResults =
      match.status === "ongoing" ||
      match.status === "ended" ||
      match.status === "completed";
    const nextKills: Record<string, string> = {};
    const nextRank: Record<string, string> = {};
    if (showStoredResults) {
      for (const p of match.participants) {
        const k = p.teamMembers?.[0]?.kills ?? 0;
        nextKills[p.id] = k > 0 ? String(k) : "";
        nextRank[p.id] =
          typeof p.rank === "number" && p.rank >= 1 ? String(p.rank) : "";
      }
    }
    setLocalKills(nextKills);
    setLocalRank(nextRank);
    setFormInitialized(true);
  }, [match, formInitialized]);

  const mode = modes.find((m) => m.id === match?.gameModeId);
  const gameName = mode ? games.find((g) => g.id === mode.gameId)?.name ?? "?" : "?";

  const handleFinish = async () => {
    if (!match) return;
    const participants = match.participants ?? [];
    const missingRank = participants.filter((p) => {
      const rankStr = localRank[p.id] ?? "";
      return rankStr.trim() === "";
    });
    if (missingRank.length > 0) {
      alert("Enter an individual rank for every player before finishing the match.");
      return;
    }
    if (!confirm("Finish this match? Results will be saved and coins transferred. This cannot be undone.")) return;
    setFinishing(true);
    try {
      const payload = {
        participants: participants.map((p) => {
          const killsStr = localKills[p.id] ?? "";
          const rankStr = localRank[p.id] ?? "";
          return {
            id: p.id,
            kills: [killsStr.trim() === "" ? 0 : Number(killsStr) || 0],
            rank: Number(rankStr) || undefined,
          };
        }),
      };
      const res = await fetch(`/api/admin/matches/${matchId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to finish match");
      }
      const data = await res.json();
      setMatch(data);
      setFormInitialized(false);
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to finish match");
    } finally {
      setFinishing(false);
    }
  };

  if (loading || !match) {
    return <AdminMatchDetailSkeleton />;
  }

  const participants = match.participants ?? [];
  const isOngoing = match.status === "ongoing";
  const hasRoomInfo = !!(match.roomCode && match.roomPassword);
  const maxParticipants = match.maxParticipants ?? 100;
  const joinedCount = match.participantCount ?? participants.length;
  const spotsLeft = Math.max(0, maxParticipants - joinedCount);

  const statusLabel =
    match.status === "ongoing"
      ? "Ongoing"
      : match.status === "cancelled"
        ? "Cancelled"
        : match.status === "ended" || match.status === "completed"
          ? "Finished"
          : "Upcoming";

  const statusClass =
    match.status === "ongoing"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : match.status === "cancelled"
        ? "bg-rose-100 text-rose-800 border-rose-200"
        : match.status === "ended" || match.status === "completed"
          ? "bg-zinc-200 text-zinc-700 border-zinc-300"
          : "bg-amber-100 text-amber-800 border-amber-200";

  if (playersOnly || subView === "players") {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={playersOnly ? onBack : () => setSubView("overview")}
          className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
        >
          {playersOnly ? "← Back to matches" : "← Back to match"}
        </button>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-bold text-zinc-900">{match.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {leaderboardMode
              ? `Final results · ${joinedCount} slot${joinedCount === 1 ? "" : "s"} filled`
              : `${joinedCount} / ${maxParticipants} slots filled`}
          </p>
        </div>

        <AdminMatchSlotsPanel
          matchType={match.matchType ?? "solo"}
          maxParticipants={maxParticipants}
          prizePool={match.prizePool}
          participants={participants}
          isOngoing={isOngoing}
          readOnly={readOnly}
          leaderboardMode={leaderboardMode}
          localKills={localKills}
          setLocalKills={setLocalKills}
          localRank={localRank}
          setLocalRank={setLocalRank}
        />

        {isOngoing && !readOnly && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <h3 className="mb-4 text-sm font-medium text-emerald-700">Finish Match</h3>
            <p className="mb-4 text-xs text-zinc-500">
              Enter kills and individual rank for every player above, then finish the match. Team placement is calculated automatically from player ranks.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              disabled={finishing}
              className="rounded-xl admin-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {finishing ? "Finishing..." : "Finish Match"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
      >
        ← Back to matches
      </button>

      {/* Hero */}
      <div className="admin-content-card overflow-hidden rounded-2xl border border-zinc-200">
        <div className="relative aspect-[16/9] w-full max-h-56 bg-zinc-100">
          <img
            src={getAdminMatchBanner(match)}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                {statusLabel}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white capitalize backdrop-blur-sm">
                {match.matchType ?? "solo"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{match.title}</h2>
            <p className="mt-1 text-sm text-white/80">
              {gameName} · {mode?.name ?? "Mode"} · {formatMatchDateTime(match.scheduledAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Match stats */}
        <section className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Match Overview
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Entry Fee", value: <CoinAmount amount={match.entryFee} size={12} /> },
              { label: "Prize Pool", value: <CoinAmount amount={match.prizePool?.totalPrizePool ?? 0} size={12} /> },
              { label: "Per Kill", value: <CoinAmount amount={match.prizePool?.coinsPerKill ?? 0} size={12} /> },
              { label: "Max Players", value: String(maxParticipants) },
              { label: "Joined", value: String(joinedCount) },
              { label: "Spots Left", value: String(spotsLeft) },
              { label: "Map", value: (match.map ?? "BERMUDA").toUpperCase() },
              { label: "Type", value: (match.matchType ?? "solo").toUpperCase() },
              { label: "Version", value: "TPP" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm font-bold text-zinc-900">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 transition-all"
              style={{ width: `${Math.min(100, (joinedCount / maxParticipants) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500 text-center">
            Registration: {joinedCount} / {maxParticipants}
          </p>
        </section>

        {/* Side panel */}
        <aside className="space-y-4">
          <button
            type="button"
            onClick={() => setSubView("players")}
            className="w-full rounded-xl border border-zinc-200 bg-white p-5 text-left transition hover:border-zinc-400 hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">See players</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {joinedCount === 0
                    ? "No registrations yet"
                    : `${joinedCount} / ${maxParticipants} slots filled`}
                </p>
              </div>
              <span className="text-lg text-zinc-400" aria-hidden>
                →
              </span>
            </div>
          </button>

          {(match.prizePool?.rankRewards ?? []).length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Rank Rewards
              </h3>
              <ul className="space-y-2">
                {(match.prizePool?.rankRewards ?? []).map((r: RankReward, i: number) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm text-zinc-700 border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
                  >
                    <span>
                      {r.fromRank === r.toRank
                        ? `Rank ${r.fromRank}`
                        : `Ranks ${r.fromRank}–${r.toRank}`}
                    </span>
                    <CoinAmount amount={r.coins} suffix=" coins" size={12} className="font-semibold text-zinc-900" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasRoomInfo && (
            <section className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Room Details
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Room ID</dt>
                  <dd className="font-mono font-semibold text-zinc-900">{match.roomCode}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Password</dt>
                  <dd className="font-mono font-semibold text-zinc-900">{match.roomPassword}</dd>
                </div>
              </dl>
            </section>
          )}
        </aside>
      </div>

      {isOngoing && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="mb-2 text-sm font-semibold text-emerald-800">Match in progress</h3>
          <p className="mb-4 text-xs text-zinc-600">
            Open the players list to update kills and ranks, then finish the match when ready.
          </p>
          <button
            type="button"
            onClick={() => setSubView("players")}
            className="rounded-xl admin-btn-primary px-4 py-2 text-sm font-medium"
          >
            See players
          </button>
        </div>
      )}
    </div>
  );
}

type AdminListItem = {
  id: string;
  adminname: string;
  isMasterAdmin: boolean;
  tabAccess: AdminTabAccess;
};

function enabledTabIds(tabAccess: AdminTabAccess): AdminTabId[] {
  return ALL_ADMIN_TAB_IDS.filter((id) => tabAccess[id]);
}

function AdminProfileModal({
  admin,
  onClose,
  onDelete,
}: {
  admin: AdminListItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }
      setNewPassword("");
      alert("Password updated successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (admin.isMasterAdmin) return;
    if (!confirm("Are you sure you want to delete this admin? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete admin");
      }
      onDelete();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete admin");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        className="relative z-10 w-full max-h-[90vh] sm:max-h-[calc(100vh-2rem)] sm:max-w-md overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-zinc-200 border-b-0 sm:border-b bg-white shadow-xl pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        {/* Mobile: drag handle */}
        <div className="sticky top-0 z-10 flex flex-col bg-white/95 backdrop-blur-sm sm:bg-white sm:backdrop-blur-none">
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-zinc-300" aria-hidden />
          </div>
          <div className="flex items-center justify-between px-4 pb-4 pt-1 sm:px-6 sm:pt-6 sm:pb-0">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900">Admin Profile</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2.5 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 touch-manipulation"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 pb-6 pt-0 sm:px-6 sm:pt-0 sm:pb-6">
          <dl className="space-y-4 sm:space-y-4">
            <div className="flex flex-col gap-1 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">Admin Name</dt>
              <dd className="font-medium text-zinc-900 break-words">{admin.adminname}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">Admin ID</dt>
              <dd className="font-mono text-sm text-zinc-500 break-all">{admin.id}</dd>
            </div>
            <div className="flex flex-col gap-1.5 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">Role</dt>
              <dd>
                <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${admin.isMasterAdmin ? "admin-badge-master" : "admin-badge"}`}>
                  {admin.isMasterAdmin ? "Master Admin" : "Admin"}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-1.5 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">Tab access</dt>
              <dd className="flex flex-wrap gap-1.5">
                {admin.isMasterAdmin ? (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">All tabs</span>
                ) : enabledTabIds(admin.tabAccess).length > 0 ? (
                  enabledTabIds(admin.tabAccess).map((id) => (
                    <span key={id} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {tabAccessLabel(id)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">No tabs assigned</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 sm:mt-8 space-y-4 border-t border-zinc-200 pt-6">
            <form onSubmit={handleChangePassword} className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="admin-input w-full flex-1 rounded-lg px-4 py-3 sm:py-2 text-sm min-h-[44px] sm:min-h-0"
              />
              <button
                type="submit"
                disabled={submitting || !newPassword || newPassword.length < 6}
                className="admin-btn-primary w-full sm:w-auto rounded-lg px-4 py-3 sm:py-2 text-sm font-medium disabled:opacity-50 min-h-[44px] sm:min-h-0 shrink-0"
              >
                {submitting ? "..." : "Change Password"}
              </button>
            </form>
            {!admin.isMasterAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full rounded-lg bg-red-600 px-4 py-3 sm:py-2 text-sm font-medium text-zinc-900 hover:bg-red-500 disabled:opacity-50 min-h-[44px] sm:min-h-0"
              >
                {deleting ? "..." : "Delete Admin"}
              </button>
            )}
            {admin.isMasterAdmin && (
              <p className="text-xs text-zinc-500">Master admin cannot be deleted. Only password can be changed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateAdminSection({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [adminname, setAdminname] = useState("");
  const [password, setPassword] = useState("");
  const [tabAccess, setTabAccess] = useState<AdminTabAccess>(() => emptyTabAccess());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminListItem | null>(null);

  const refreshAdmins = useCallback(() => {
    fetch("/api/admin/admins")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setAdmins(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshAdmins();
  }, [refreshAdmins]);

  const toggleTab = (tabId: AdminTabId) => {
    setTabAccess((prev) => ({ ...prev, [tabId]: !prev[tabId] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!Object.values(tabAccess).some(Boolean)) {
      setError("Select at least one tab permission");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminname,
          password,
          tabAccess,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create admin");
        return;
      }
      setAdminname("");
      setPassword("");
      setTabAccess(emptyTabAccess());
      refreshAdmins();
      onSuccess();
    } catch {
      setError("Failed to create admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="admin-panel w-full">
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Create Admin</h2>
        <p className="mb-6 text-sm text-zinc-500">Create credentials and choose which admin panel tabs this user can open.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-600">Admin Name</label>
            <input
              type="text"
              value={adminname}
              onChange={(e) => setAdminname(e.target.value)}
              required
              className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
              placeholder="adminname"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-600">Tab permissions</label>
            <p className="text-xs text-zinc-500">Dashboard is always available. Select the sections this admin can manage.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ADMIN_TAB_DEFINITIONS.map((def) => (
                <label
                  key={def.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 transition hover:border-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={tabAccess[def.id]}
                    onChange={() => toggleTab(def.id)}
                    className="rounded border-zinc-300"
                  />
                  <AdminTabIcon tab={def.id} className="h-5 w-5 shrink-0" />
                  <span className="text-sm text-zinc-700">{def.label}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-300">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Admin"}
          </button>
        </form>
      </section>
      <section className="admin-panel w-full">
        <h2 className="mb-1 text-base font-semibold text-zinc-900">Existing Admins</h2>
        <p className="mb-5 text-sm text-zinc-500">{admins.length} admin(s)</p>
        <ul className="space-y-2">
          {admins.map((a) => (
            <li
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedAdmin(a)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedAdmin(a)}
              className="admin-list-item flex cursor-pointer flex-col gap-2 rounded-xl px-4 py-3.5 transition hover:border-zinc-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="shrink-0 font-medium text-zinc-700">{a.adminname}</span>
              <div className="flex flex-wrap gap-1.5">
                {a.isMasterAdmin && (
                  <span className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Master</span>
                )}
                {!a.isMasterAdmin && enabledTabIds(a.tabAccess).map((id) => (
                  <span key={id} className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {tabAccessLabel(id)}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {selectedAdmin && (
        <AdminProfileModal
          admin={selectedAdmin}
          onClose={() => setSelectedAdmin(null)}
          onDelete={() => {
            refreshAdmins();
            setSelectedAdmin(null);
          }}
        />
      )}
    </div>
  );
}

function UsersSection({
  users,
  canAddCoins,
  onPatchUser,
  onUserRemoved,
}: {
  users: User[];
  canAddCoins: boolean;
  onPatchUser: (user: User) => void;
  onUserRemoved: (userId: string) => void;
}) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [usersTab, setUsersTab] = useState<"all" | "blocked">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const searchTrimmed = searchQuery.trim().toLowerCase();
  const filteredUsers = users
    .filter((u) => (usersTab === "blocked" ? u.isBlocked === true : true))
    .filter((u) => {
      if (!searchTrimmed) return true;
      const username = (u.username || u.id).toLowerCase();
      const displayName = u.displayName.toLowerCase();
      return username.includes(searchTrimmed) || displayName.includes(searchTrimmed);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Users List</h1>
        <p className="text-zinc-500 text-sm">
          View registered users, normal balances, win balances, block/unblock, and add coins.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex bg-zinc-50/60 p-1 rounded-xl border border-zinc-200 w-fit">
          {(["all", "blocked"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setUsersTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                usersTab === t ? "admin-btn-primary" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t === "all" ? "All Users" : "Blocked Only"}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-input rounded-xl px-4 py-2.5 text-sm w-full sm:w-72 outline-none"
        />
      </div>

      <section className="admin-table-panel w-full">
        {filteredUsers.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">No users found</p>
        ) : (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="text-left">Display Name</th>
                  <th className="text-left">Username</th>
                  <th className="text-right">Normal Coins</th>
                  <th className="text-right">Win Coins</th>
                  <th className="text-right">Total Coins</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const winCoins = u.wonCoins ?? 0;
                  const normalCoins = Math.max(0, u.coins - winCoins);
                  return (
                    <tr key={u.id}>
                      <td className="font-semibold text-zinc-900">{u.displayName}</td>
                      <td className="font-mono text-zinc-500">{u.username || u.id}</td>
                      <td className="text-right font-medium text-amber-300"><CoinAmount amount={normalCoins} size={14} className="justify-end" /></td>
                      <td className="text-right font-medium text-zinc-900"><CoinAmount amount={winCoins} size={14} className="justify-end" /></td>
                      <td className="text-right font-bold text-zinc-900"><CoinAmount amount={u.coins} size={14} className="justify-end" /></td>
                      <td className="text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                            u.isBlocked === true
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/20"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
                          }`}
                        >
                          {u.isBlocked === true ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(u)}
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-900 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          canAddCoins={canAddCoins}
          onClose={() => setSelectedUser(null)}
          onUserUpdate={(updated) => {
            onPatchUser(updated);
            setSelectedUser(updated);
          }}
          onDelete={() => {
            onUserRemoved(selectedUser.id);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

function UserProfileModal({
  user: initialUser,
  canAddCoins,
  onClose,
  onUserUpdate,
  onDelete,
}: {
  user: User;
  canAddCoins: boolean;
  onClose: () => void;
  onUserUpdate: (user: User) => void;
  onDelete: () => void;
}) {
  const toUserRecord = (raw: unknown): User => {
    const u = normalizeAdminUser(raw);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      coins: u.coins,
      wonCoins: u.wonCoins,
      isBlocked: u.isBlocked,
      blockReason: u.blockReason,
      username: u.username,
    };
  };

  const [profile, setProfile] = useState<User>(() => toUserRecord(initialUser));
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blockReasonDraft, setBlockReasonDraft] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    setProfileError(null);
    setBlockReasonDraft("");
    setShowBlockForm(false);

    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${initialUser.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const fresh = toUserRecord(await res.json());
        if (!cancelled) setProfile(fresh);
      } catch {
        if (!cancelled) {
          setProfileError("Could not load the latest profile. Showing cached data.");
          setProfile(toUserRecord(initialUser));
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialUser.id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showBlockForm) {
        setShowBlockForm(false);
        setBlockReasonDraft("");
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
    };
  }, [onClose, showBlockForm]);

  const isBlocked = profile.isBlocked === true;

  const applyUpdatedUser = (raw: unknown) => {
    const updated = toUserRecord(raw);
    setProfile(updated);
    onUserUpdate(updated);
    if (!updated.isBlocked) {
      setBlockReasonDraft("");
      setShowBlockForm(false);
    }
  };

  const handleAddCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      if (!res.ok) throw new Error(await res.text());
      applyUpdatedUser(await res.json());
      setAmount("");
    } catch {
      alert("Failed to add coins");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlockUser = async () => {
    const reason = blockReasonDraft.trim();
    if (!reason) {
      alert("Please enter a reason before blocking this user.");
      return;
    }
    if (!confirm(`Block ${profile.displayName}? They will see this reason in the app:\n\n"${reason}"`)) {
      return;
    }
    setBlocking(true);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to block user");
      }
      applyUpdatedUser(await res.json());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to block user");
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!confirm(`Unblock ${profile.displayName}?`)) return;
    setBlocking(true);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}/unblock`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      applyUpdatedUser(await res.json());
    } catch {
      alert("Failed to unblock user");
    } finally {
      setBlocking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      onDelete();
    } catch {
      alert("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const winCoins = profile.wonCoins ?? 0;
  const normalCoins = Math.max(0, profile.coins - winCoins);

  return (
    <div
      className="fixed inset-0 top-16 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-6rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">User Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loadingProfile ? (
          <p className="mb-4 text-sm text-zinc-500">Loading latest profile…</p>
        ) : null}
        {profileError ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {profileError}
          </p>
        ) : null}

        <dl className="space-y-4 text-zinc-600">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Display Name</span>
            <p className="mt-1 font-medium text-zinc-900">{profile.displayName}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Email</span>
            <p className="mt-1 text-zinc-700">{profile.email}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Username / ID</span>
            <p className="mt-1 font-mono text-sm text-zinc-500">{profile.username || profile.id}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Normal Coins</span>
              <p className="mt-1 font-semibold text-amber-300"><CoinAmount amount={normalCoins} size={16} /></p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Won Coins</span>
              <p className="mt-1 font-semibold text-zinc-900"><CoinAmount amount={winCoins} size={16} /></p>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Coins</span>
            <p className="mt-1 font-bold text-zinc-900 text-lg"><CoinAmount amount={profile.coins} size={18} /></p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status</span>
            <div className="mt-1">
              <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${isBlocked ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                {isBlocked ? "Blocked" : "Active"}
              </span>
            </div>
          </div>
          {isBlocked ? (
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Ban Reason</span>
              <p className="mt-1 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {profile.blockReason?.trim() || "No reason recorded."}
              </p>
            </div>
          ) : null}
        </dl>
        <div className="mt-8 space-y-4 border-t border-zinc-200 pt-6">
          {canAddCoins && !isBlocked && (
            <form onSubmit={handleAddCoins} className="flex gap-2">
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="admin-input w-24 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={submitting || !amount}
                className="admin-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "Adding..." : "Add Coins"}
              </button>
            </form>
          )}
          {!isBlocked && showBlockForm ? (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <label htmlFor="block-reason" className="mb-2 block text-sm font-semibold text-zinc-900">
                Block reason (required)
              </label>
              <p className="mb-3 text-xs text-zinc-600">
                Enter the reason below, then confirm. The player will see this on their account screen.
              </p>
              <textarea
                id="block-reason"
                value={blockReasonDraft}
                onChange={(e) => setBlockReasonDraft(e.target.value)}
                placeholder="e.g. Using hacks in tournament..."
                rows={4}
                disabled={loadingProfile || blocking}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!isBlocked ? (
              showBlockForm ? (
                <>
                  <button
                    type="button"
                    onClick={handleBlockUser}
                    disabled={loadingProfile || blocking || !blockReasonDraft.trim()}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {blocking ? "Blocking..." : "Confirm Block"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBlockForm(false);
                      setBlockReasonDraft("");
                    }}
                    disabled={blocking}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBlockForm(true);
                  }}
                  disabled={loadingProfile || blocking}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Block
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleUnblock}
                disabled={loadingProfile || blocking}
                className="admin-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {blocking ? "Unblocking..." : "Unblock"}
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-red-500 disabled:opacity-50"
            >
              {deleting ? "..." : "Delete Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type DepositRequestWithUser = {
  id: string;
  userId: string;
  amount: number;
  utr: string;
  status: string;
  createdAt: string;
  user?: User;
};

type WithdrawalRequestWithUser = {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  status: string;
  rejectNote?: string;
  chargePercent?: number;
  createdAt: string;
  user?: User;
};

function DashboardSection({
  stats,
  loading,
  session,
  onNavigate,
  onRefresh,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  session: AdminSession | null;
  onNavigate: (t: Tab) => void;
  onRefresh: () => void;
}) {
  const canUsers = session ? canAccessAdminTab(session, "users") : false;
  const canWithdrawals = session ? canAccessAdminTab(session, "withdrawals") : false;
  const canDeposits = session ? canAccessAdminTab(session, "moneyorders") : false;
  const canModes = session ? canAccessAdminTab(session, "modes") : false;

  const fmtCoins = (n: number) => n.toLocaleString("en-IN");
  const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  if (!stats) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-zinc-500 text-sm">Could not load dashboard statistics.</p>
        <button type="button" onClick={onRefresh} className="admin-btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const { users, money, matches, upcomingMatches, pendingWithdrawals } = stats;

  const statCard = (
    label: string,
    value: string | number,
    onClick?: () => void,
    accent?: "red" | "green" | "blue" | "amber" | "purple" | "cyan",
  ) => (
    <div
      key={label}
      className={`stat-card ${accent ?? "blue"}${onClick ? " cursor-pointer" : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div>
        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Dashboard</h1>
          <p className="text-zinc-500 text-sm">
            Aggregated platform metrics from the database. Updated{" "}
            {stats.generatedAt ? formatMatchDateTime(stats.generatedAt) : "recently"}.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="admin-btn-primary self-start rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh stats"}
        </button>
      </div>

      <section>
        <h2 className="dashboard-section-title">Actions &amp; ops</h2>
        <div className="stat-card-grid">
          {canWithdrawals &&
            statCard(
              "Pending withdrawals",
              `${money.pendingWithdrawalsCount} · ${fmtCoins(money.pendingWithdrawalsAmount)}`,
              () => onNavigate("withdrawals"),
              "amber",
            )}
          {canModes && statCard("Upcoming matches", matches.upcoming, () => onNavigate("modes"), "green")}
          {canModes && statCard("Live matches", matches.ongoing, () => onNavigate("modes"), "cyan")}
          {canUsers && statCard("Blocked users", users.blocked, () => onNavigate("users"), "red")}
        </div>
      </section>

      <section>
        <h2 className="dashboard-section-title">Money &amp; platform health</h2>
        <div className="stat-card-grid">
          {canDeposits &&
            statCard("Total deposits", fmtCoins(money.totalDeposits), () => onNavigate("moneyorders"), "blue")}
          {canWithdrawals &&
            statCard(
              "Total withdrawals",
              fmtCoins(money.totalWithdrawals),
              () => onNavigate("withdrawals"),
              "amber",
            )}
          {(canDeposits || canWithdrawals) &&
            statCard("Net flow", fmtCoins(money.netFlow), undefined, money.netFlow >= 0 ? "green" : "red")}
          {canWithdrawals &&
            statCard("Pending payout liability", fmtCoins(money.pendingWithdrawalsAmount), () => onNavigate("withdrawals"), "purple")}
          {canUsers && statCard("Coins in wallets", fmtCoins(users.walletCoins), () => onNavigate("users"))}
          {canUsers && statCard("Withdrawable winnings", fmtCoins(users.withdrawableWinnings), () => onNavigate("users"))}
        </div>
      </section>

      <section>
        <h2 className="dashboard-section-title">Growth &amp; activity (7 days)</h2>
        <div className="stat-card-grid">
          {canUsers && statCard("New users (7d)", users.new7d, () => onNavigate("users"), "green")}
          {canUsers && statCard("New users (30d)", users.new30d, () => onNavigate("users"))}
          {canUsers && statCard("New users today", users.newToday, () => onNavigate("users"))}
          {canDeposits && statCard("Deposits (7d)", fmtCoins(money.deposits7d), () => onNavigate("moneyorders"), "blue")}
          {canDeposits && statCard("Deposits today", fmtCoins(money.depositsToday), () => onNavigate("moneyorders"))}
          {canModes && statCard("Completed matches (7d)", matches.completed7d, () => onNavigate("modes"))}
          {canUsers && statCard("Push-enabled users", users.pushEnabled, () => onNavigate("users"), "purple")}
          {canUsers && statCard("Active players", users.activePlayers, () => onNavigate("users"))}
          {canUsers && statCard("Total users", users.total, () => onNavigate("users"), "red")}
        </div>
      </section>

      <section>
        <h2 className="dashboard-section-title">Matches &amp; engagement</h2>
        <div className="stat-card-grid">
          {canModes && statCard("Completed matches", matches.completed, () => onNavigate("modes"), "green")}
          {canModes && statCard("Avg upcoming fill rate", fmtPct(matches.avgUpcomingFillRate), () => onNavigate("modes"))}
          {canModes && statCard("Entry fees collected", fmtCoins(matches.entryFeesCollected), () => onNavigate("modes"), "blue")}
          {canModes && statCard("Solo / Duo / Squad", `${matches.solo} / ${matches.duo} / ${matches.squad}`, () => onNavigate("modes"))}
        </div>
      </section>

      <div className="dashboard-quick-grid">
        {canModes && upcomingMatches.length > 0 && (
          <section className="dashboard-quick-panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="dashboard-section-title mb-0">Next upcoming matches</h2>
              <button type="button" onClick={() => onNavigate("modes")} className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">
                View all
              </button>
            </div>
            <ul className="dashboard-quick-list">
              {upcomingMatches.map((m) => (
                <li key={m.id} className="dashboard-quick-item">
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">{m.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {m.scheduledAt ? formatMatchDateTime(m.scheduledAt) : "TBD"} · {m.matchType}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-zinc-900">
                      {m.participantCount}/{m.maxParticipants}
                    </p>
                    <p className="text-xs text-zinc-500">{fmtPct(m.fillRate)} · {fmtCoins(m.entryFee)} fee</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {canWithdrawals && pendingWithdrawals.length > 0 && (
          <section className="dashboard-quick-panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="dashboard-section-title mb-0">Pending withdrawal queue</h2>
              <button type="button" onClick={() => onNavigate("withdrawals")} className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">
                View all
              </button>
            </div>
            <ul className="dashboard-quick-list">
              {pendingWithdrawals.map((w) => (
                <li key={w.id} className="dashboard-quick-item">
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">{w.userDisplayName}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">{w.upiId || w.userEmail}</p>
                  </div>
                  <p className="font-semibold text-zinc-900 text-sm">{fmtCoins(w.amount)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function MoneyOrdersSection({
  deposits,
  users,
  onSuccess,
}: {
  deposits: any[];
  users: User[];
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = deposits.filter((d) => {
    // Only show successful deposits processed via ZapUPI payments gateway
    if (d.status !== "accepted") return false;

    const user = users.find((u) => u.id === d.userId);
    const name = user?.displayName?.toLowerCase() || "";
    const email = user?.email?.toLowerCase() || "";
    const utr = d.utr?.toLowerCase() || "";
    return (
      name.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase()) ||
      utr.includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Deposits</h1>
          <p className="text-zinc-500 text-sm">View successful deposits processed automatically via ZapUPI Payment Gateway.</p>
        </div>

        <input
          type="text"
          placeholder="Search by user or UTR..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-input rounded-xl px-4 py-2.5 text-sm w-full sm:w-64 outline-none"
        />
      </div>

      <div className="admin-table-panel w-full">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">No successful deposits found</p>
        ) : (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="text-left">User</th>
                  <th className="text-left">UTR Reference</th>
                  <th className="text-right">Amount Credited</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const user = users.find((u) => u.id === d.userId);
                  return (
                    <tr key={d.id}>
                      <td>
                        <p className="font-semibold text-zinc-900">{user?.displayName || "Unknown"}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">{d.userId}</p>
                      </td>
                      <td>
                        <p className="font-mono font-medium text-zinc-600">{d.utr}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{new Date(d.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="text-right font-bold text-amber-300"><CoinAmount amount={d.amount} size={14} className="justify-end" /></td>
                      <td className="text-center">
                        <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300">
                          succeeded
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AddCoinsSection users={users} onSuccess={onSuccess} />
    </div>
  );
}

function WithdrawalsSection({
  withdrawals,
  users,
  onSuccess,
}: {
  withdrawals: any[];
  users: User[];
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [withdrawalCharge, setWithdrawalCharge] = useState(0);
  const [chargeInput, setChargeInput] = useState("");
  const [savingCharge, setSavingCharge] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCharge = async () => {
      const res = await fetch("/api/admin/withdrawal-charge");
      if (res.ok) {
        const { chargePercent } = await res.json();
        setWithdrawalCharge(chargePercent);
        setChargeInput(String(chargePercent));
      }
    };
    fetchCharge();
  }, []);

  const handleSaveCharge = async () => {
    const p = Number(chargeInput);
    if (isNaN(p) || p < 0 || p > 100) {
      alert("Charge must be 0-100");
      return;
    }
    setSavingCharge(true);
    try {
      const res = await fetch("/api/admin/withdrawal-charge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargePercent: p }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { chargePercent } = await res.json();
      setWithdrawalCharge(chargePercent);
      setChargeInput(String(chargePercent));
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingCharge(false);
    }
  };

  const handleWithdrawAccept = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/accept`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawReject = async (id: string) => {
    const note = prompt("Enter rejection reason (e.g. wrong UPI ID):");
    if (note === null) return;
    const trimmed = note.trim();
    if (!trimmed) {
      alert("Rejection note is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const filtered = withdrawals.filter((w) => {
    const user = users.find((u) => u.id === w.userId);
    const name = user?.displayName?.toLowerCase() || "";
    const upi = w.upiId?.toLowerCase() || "";
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || upi.includes(searchQuery.toLowerCase());

    if (filterStatus === "all") return matchesSearch;
    return w.status === filterStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Withdrawals</h1>
        <p className="text-zinc-500 text-sm">Review payouts. UPI IDs are paid via UPI; email addresses receive a Google Play redeem code.</p>
      </div>

      <section className="admin-panel w-full">
        <h3 className="mb-2 text-sm font-semibold text-zinc-600">Withdrawal Service Charge</h3>
        <p className="mb-4 text-xs text-zinc-500 font-medium">
          Define the platform commission (%) deducted automatically upon payout.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={chargeInput}
              onChange={(e) => setChargeInput(e.target.value)}
              className="admin-input w-24 rounded-lg px-3 py-2 text-sm outline-none"
            />
            <span className="text-sm text-zinc-500">%</span>
          </div>
          <button
            type="button"
            onClick={handleSaveCharge}
            disabled={savingCharge}
            className="admin-btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-50"
          >
            {savingCharge ? "Saving..." : "Save Config"}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex bg-zinc-50/60 p-1 rounded-xl border border-zinc-200 w-fit">
          {(["all", "pending", "accepted", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filterStatus === s ? "admin-btn-primary text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name, UPI, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-input rounded-xl px-4 py-2 text-sm w-full md:w-64 outline-none"
        />
      </div>

      <div className="admin-table-panel w-full">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">No withdrawals found</p>
        ) : (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="text-left">User</th>
                  <th className="text-left">UPI / Email</th>
                  <th className="text-right">Debit Coins</th>
                  <th className="text-right">Net Payout</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const user = users.find((u) => u.id === w.userId);
                  const netPayout = Math.round(w.amount * (1 - (w.chargePercent ?? 0) / 100));
                  return (
                    <tr key={w.id}>
                      <td>
                        <p className="font-semibold text-zinc-900">{user?.displayName || "Unknown"}</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">{w.userId}</p>
                      </td>
                      <td>
                        <p className="font-medium text-zinc-600">{w.upiId}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{new Date(w.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="text-right font-semibold text-rose-400"><CoinAmount amount={`- ${w.amount}`} size={14} className="justify-end" /></td>
                      <td className="text-right font-bold text-zinc-900">₹ {netPayout}</td>
                      <td className="text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                            w.status === "accepted"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : w.status === "rejected"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {w.status}
                        </span>
                        {w.rejectNote && (
                          <p className="text-xs text-rose-400 mt-1 max-w-[120px] mx-auto truncate" title={w.rejectNote}>
                            Note: {w.rejectNote}
                          </p>
                        )}
                      </td>
                      <td className="text-right">
                        {w.status === "pending" && (
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleWithdrawAccept(w.id)}
                              className="admin-btn-primary rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleWithdrawReject(w.id)}
                              className="bg-rose-600 hover:bg-rose-500 text-zinc-900 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PushNotificationsSection() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [target, setTarget] = useState<"all" | "active" | "blocked">("all");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const h = localStorage.getItem("admin_push_history");
    if (h) setHistory(JSON.parse(h));
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert("Title and Body are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          link: link.trim() || null,
          target,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send notification");
      }

      const newNotification = {
        id: `push-${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || null,
        target,
        sentAt: new Date().toISOString(),
        successCount: data.successCount ?? 0,
        failureCount: data.failureCount ?? 0,
        totalTokens: data.totalTokens ?? 0,
      };

      const updatedHistory = [newNotification, ...history];
      setHistory(updatedHistory);
      localStorage.setItem("admin_push_history", JSON.stringify(updatedHistory));

      setTitle("");
      setBody("");
      setLink("");
      alert(
        `Sent to ${data.successCount ?? 0} device${data.successCount === 1 ? "" : "s"}` +
          (data.failureCount ? ` (${data.failureCount} failed)` : "") +
          `.`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear notification history?")) {
      setHistory([]);
      localStorage.removeItem("admin_push_history");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Push Notifications</h1>
        <p className="text-zinc-500 text-sm">Send dynamic Firebase notifications directly to users' Android applications.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSend} className="admin-panel w-full lg:col-span-2 space-y-5">
          <h3 className="text-lg font-bold text-zinc-900 mb-2">Compose Broadcast</h3>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Target Segment</label>
            <div className="flex gap-2">
              {(["all", "active", "blocked"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold uppercase transition ${
                    target === t ? "admin-btn-primary text-zinc-900" : "bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
                  }`}
                >
                  {t === "all" ? "All Users" : t === "active" ? "Active Only" : "Blocked Only"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-600">Notification Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Free Fire Tournament Starting Soon!"
              className="admin-input w-full rounded-xl px-4 py-3 text-sm text-zinc-900 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-600">Notification Body</label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Join the Bermuda Daily Solo match. Entry is 10 coins. Huge prize pools!"
              className="admin-input w-full rounded-xl px-4 py-3 text-sm text-zinc-900 resize-none outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-600">Action Link (Optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="e.g. https://kingbattle.site/match/match-101"
              className="admin-input w-full rounded-xl px-4 py-3 text-sm text-zinc-900 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="admin-btn-primary w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {sending ? "Broadcasting..." : "Send Broadcast Now"}
          </button>
        </form>

        <div className="admin-panel w-full flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-zinc-900">Broadcast History</h3>
            {history.length > 0 && (
              <button type="button" onClick={handleClearHistory} className="text-xs text-red-400 hover:text-red-300">
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {history.length === 0 ? (
              <p className="text-sm text-zinc-500 py-12 text-center my-auto">No notifications sent yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="bg-zinc-50/30 border border-zinc-200/30 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span className="font-bold uppercase tracking-wider text-green-500/80">{h.target}</span>
                    <span>{new Date(h.sentAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-semibold text-sm text-zinc-700">{h.title}</h4>
                  <p className="text-xs text-zinc-500 line-clamp-2">{h.body}</p>
                  {typeof h.successCount === "number" && (
                    <p className="text-[10px] text-zinc-500">
                      {h.successCount} delivered
                      {h.failureCount ? ` · ${h.failureCount} failed` : ""}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppSettingsSection({ onSuccess }: { onSuccess: () => void }) {
  const [announcementInput, setAnnouncementInput] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const [signupBonusInput, setSignupBonusInput] = useState("");
  const [savingBonus, setSavingBonus] = useState(false);

  const [supportUrlInput, setSupportUrlInput] = useState("");
  const [savingSupport, setSavingSupport] = useState(false);

  const [depositQrUrl, setDepositQrUrl] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [savingQr, setSavingQr] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const [annRes, qrRes, bonusRes, supRes] = await Promise.all([
        fetch("/api/admin/announcement"),
        fetch("/api/admin/deposit-qr"),
        fetch("/api/admin/signup-bonus"),
        fetch("/api/admin/customer-support"),
      ]);

      if (annRes.ok) {
        const { text } = await annRes.json();
        setAnnouncementInput(text || "");
      }
      if (qrRes.ok) {
        const { url } = await qrRes.json();
        setDepositQrUrl(url);
      }
      if (bonusRes.ok) {
        const { signupBonus: bonus } = await bonusRes.json();
        setSignupBonusInput(String(bonus));
      }
      if (supRes.ok) {
        const { url } = await supRes.json();
        setSupportUrlInput(url || "");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleQrFileChange = (file: File) => {
    setQrFile(file);
    setQrPreview(URL.createObjectURL(file));
  };

  const handleQrClear = () => {
    setQrFile(null);
    if (qrPreview) URL.revokeObjectURL(qrPreview);
    setQrPreview(null);
  };

  const handleSaveQr = async () => {
    if (qrFile) {
      setSavingQr(true);
      try {
        const url = await uploadImage(qrFile);
        const res = await fetch("/api/admin/deposit-qr", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { url: savedUrl } = await res.json();
        setDepositQrUrl(savedUrl);
        handleQrClear();
        onSuccess();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to upload QR");
      } finally {
        setSavingQr(false);
      }
    } else if (depositQrUrl) {
      if (!confirm("Remove the deposit QR code? Users will see a placeholder.")) return;
      setSavingQr(true);
      try {
        const res = await fetch("/api/admin/deposit-qr", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: null }),
        });
        if (!res.ok) throw new Error(await res.text());
        setDepositQrUrl(null);
        onSuccess();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to remove QR");
      } finally {
        setSavingQr(false);
      }
    }
  };

  const handleSaveAnnouncement = async () => {
    const trimmed = announcementInput.trim();
    setSavingAnnouncement(true);
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementText: trimmed || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { text } = await res.json();
      setAnnouncementInput(text || "");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleSaveSignupBonus = async () => {
    const num = Number(signupBonusInput);
    if (isNaN(num) || num < 0) {
      alert("Bonus must be 0 or greater");
      return;
    }
    setSavingBonus(true);
    try {
      const res = await fetch("/api/admin/signup-bonus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupBonus: num }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { signupBonus: bonus } = await res.json();
      setSignupBonusInput(String(bonus));
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingBonus(false);
    }
  };

  const handleSaveSupportUrl = async () => {
    const trimmed = supportUrlInput.trim();
    setSavingSupport(true);
    try {
      const res = await fetch("/api/admin/customer-support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setSupportUrlInput(url || "");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSupport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">App Settings</h1>
        <p className="text-zinc-500 text-sm">
          Configure marquee announcement texts, customer support channels, signup incentives, and gateway QR codes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="admin-panel w-full space-y-4">
          <div>
            <h3 className="text-md font-bold text-zinc-600">Marquee Announcement</h3>
            <p className="text-xs text-zinc-500 mt-1">This text scrolls at the top of the user app home page.</p>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              value={announcementInput}
              onChange={(e) => setAnnouncementInput(e.target.value)}
              className="admin-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              placeholder="Enter marquee message..."
            />
            <button
              type="button"
              onClick={handleSaveAnnouncement}
              disabled={savingAnnouncement}
              className="admin-btn-primary rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {savingAnnouncement ? "Saving..." : "Save Announcement"}
            </button>
          </div>
        </section>

        <section className="admin-panel w-full space-y-4">
          <div>
            <h3 className="text-md font-bold text-zinc-600">Signup Coin Bonus</h3>
            <p className="text-xs text-zinc-500 mt-1">Free balance credited to newly registered players.</p>
          </div>
          <div className="space-y-2">
            <input
              type="number"
              value={signupBonusInput}
              onChange={(e) => setSignupBonusInput(e.target.value)}
              className="admin-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              placeholder="0"
            />
            <button
              type="button"
              onClick={handleSaveSignupBonus}
              disabled={savingBonus}
              className="admin-btn-primary rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {savingBonus ? "Saving..." : "Save Bonus"}
            </button>
          </div>
        </section>

        <section className="admin-panel w-full space-y-4">
          <div>
            <h3 className="text-md font-bold text-zinc-600">Customer Support URL</h3>
            <p className="text-xs text-zinc-500 mt-1">
              WhatsApp wa.me link, Telegram t.me link, or general support contact channel.
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="url"
              value={supportUrlInput}
              onChange={(e) => setSupportUrlInput(e.target.value)}
              className="admin-input w-full rounded-lg px-3 py-2 text-sm outline-none"
              placeholder="e.g. https://wa.me/919876543210"
            />
            <button
              type="button"
              onClick={handleSaveSupportUrl}
              disabled={savingSupport}
              className="admin-btn-primary rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {savingSupport ? "Saving..." : "Save Support"}
            </button>
          </div>
        </section>

        <section className="admin-panel w-full space-y-4">
          <div>
            <h3 className="text-md font-bold text-zinc-600">Manual Deposit QR Code</h3>
            <p className="text-xs text-zinc-500 mt-1">UPI barcode scanned by users to deposit money manually.</p>
          </div>
          <div className="flex flex-col gap-3">
            <label className="admin-input flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-4 transition hover:border-zinc-400">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleQrFileChange(f);
                }}
              />
              {qrPreview || depositQrUrl ? (
                <img
                  src={qrPreview ?? depositQrUrl ?? ""}
                  alt="Deposit QR"
                  className="max-h-24 max-w-24 rounded-lg object-contain"
                />
              ) : (
                <span className="text-xs text-zinc-500">Click to upload UPI QR code</span>
              )}
            </label>
            <div className="flex gap-2">
              {qrFile && (
                <button
                  type="button"
                  onClick={handleQrClear}
                  className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveQr}
                disabled={savingQr || (!qrFile && !depositQrUrl)}
                className="admin-btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-900 disabled:opacity-50"
              >
                {savingQr ? "Saving..." : qrFile ? "Upload & Update" : "Remove QR"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AddCoinsSection({
  users,
  onSuccess,
}: {
  users: User[];
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("From admin");
  const [submitting, setSubmitting] = useState(false);

  const searchTrimmed = searchQuery.trim();
  const matchedUser = searchTrimmed
    ? users.find((u) => u.id.toLowerCase().includes(searchTrimmed.toLowerCase()))
    : null;
  const showNoUserFound = searchTrimmed.length > 0 && !matchedUser;
  const displayUser = matchedUser ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayUser || !amount) return;
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${displayUser.id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, description: note.trim() || "From admin" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAmount("");
      setNote("From admin");
      setSearchQuery("");
      onSuccess();
    } catch (err) {
      alert("Failed to add coins");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-panel w-full">
      <h2 className="mb-1 text-base font-semibold text-zinc-900">Add Coins</h2>
      <p className="mb-6 text-sm text-zinc-500">Search by user ID, then add coins to their account</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-600">Search by User ID</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
            placeholder="Type user ID..."
          />
        </div>

        {showNoUserFound && (
          <p className="rounded-lg bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-300">
            No user found
          </p>
        )}

        {displayUser && !showNoUserFound && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/30 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                User found — confirm before adding coins
              </p>
              <p className="font-mono text-sm text-zinc-500">{displayUser.id}</p>
              <p className="font-semibold text-zinc-900">{displayUser.displayName}</p>
              <p className="text-sm text-zinc-500">{displayUser.email}</p>
              <p className="mt-1 text-sm font-medium text-amber-300"><CoinAmount amount={displayUser.coins} suffix=" coins" size={14} /></p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-600">Amount to Add</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                placeholder="e.g. 100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-600">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                placeholder="e.g. From admin, Refund, Winnings, Match entry..."
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Coins"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

function BannersSection() {
  interface Banner {
    id: string;
    imageUrl: string;
    linkUrl: string;
    displayPlayCarousel: boolean;
    displayEarn: boolean;
    createdAt?: string;
  }

  const [banners, setBanners] = useState<Banner[]>([]);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states for creating
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [displayPlayCarousel, setDisplayPlayCarousel] = useState(false);
  const [displayEarn, setDisplayEarn] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Edit states
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editDisplayPlayCarousel, setEditDisplayPlayCarousel] = useState(false);
  const [editDisplayEarn, setEditDisplayEarn] = useState(false);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      if (res.ok) {
        const data = await res.json();
        setBanners(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      alert("Please upload a banner image");
      return;
    }
    setSubmitting(true);
    try {
      const finalImageUrl = await uploadImage(imageFile);
      if (!linkUrl.trim()) {
        alert("Please provide a destination link URL");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: finalImageUrl,
          linkUrl: linkUrl.trim(),
          displayPlayCarousel,
          displayEarn,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data?.id) {
          alert("Failed to add banner — server did not return a saved banner.");
          return;
        }
        setImageUrl("");
        setLinkUrl("");
        setDisplayPlayCarousel(false);
        setDisplayEarn(false);
        setImageFile(null);
        setPreviewUrl(null);
        fetchBanners();
        setView("list");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add banner");
      }
    } catch (err: any) {
      alert(err.message || "Failed to add banner");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    setSubmitting(true);
    try {
      let finalImageUrl = editImageUrl.trim();
      if (editImageFile) {
        finalImageUrl = await uploadImage(editImageFile);
      }

      if (!finalImageUrl) {
        alert("Please upload a banner image");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/admin/banners", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBanner.id,
          imageUrl: finalImageUrl,
          linkUrl: editLinkUrl.trim(),
          displayPlayCarousel: editDisplayPlayCarousel,
          displayEarn: editDisplayEarn,
        }),
      });

      if (res.ok) {
        setEditingBanner(null);
        setEditImageFile(null);
        setEditPreviewUrl(null);
        fetchBanners();
        setView("list");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save banner");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save banner");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/banners?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchBanners();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete banner");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete banner");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setEditImageUrl(banner.imageUrl);
    setEditLinkUrl(banner.linkUrl);
    setEditDisplayPlayCarousel(banner.displayPlayCarousel);
    setEditDisplayEarn(banner.displayEarn);
    setEditPreviewUrl(banner.imageUrl);
    setEditImageFile(null);
    setView("edit");
  };

  return (
    <div className="space-y-6">
      {view === "list" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">App Banners</h2>
              <p className="text-zinc-500 text-sm">Manage promotional and event banners shown in the app.</p>
            </div>
            <button
              type="button"
              onClick={() => setView("create")}
              className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold shrink-0"
            >
              + Add New Banner
            </button>
          </div>

          <section className="space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">Existing Banners</h3>
            {loading ? (
              <AdminBannerGridSkeleton count={3} />
            ) : banners.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 border border-zinc-200/40 rounded-xl bg-zinc-100/20">
                No banners configured yet.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {banners.map((b) => (
                  <article
                    key={b.id}
                    className="admin-content-card group overflow-hidden rounded-2xl border border-zinc-200 transition hover:border-zinc-300 hover:shadow-md"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                      {b.imageUrl ? (
                        <img
                          src={b.imageUrl}
                          alt="App banner"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                          No image
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${
                            b.displayPlayCarousel
                              ? "bg-emerald-500/90 text-white"
                              : "bg-black/40 text-white/80"
                          }`}
                        >
                          Play Carousel
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${
                            b.displayEarn
                              ? "bg-emerald-500/90 text-white"
                              : "bg-black/40 text-white/80"
                          }`}
                        >
                          Earn Tab
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 sm:p-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Destination Link
                        </p>
                        <a
                          href={b.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-sm font-medium text-zinc-900 hover:text-zinc-600 hover:underline"
                          title={b.linkUrl}
                        >
                          {b.linkUrl}
                        </a>
                      </div>

                      {b.createdAt && (
                        <p className="text-xs text-zinc-400">
                          Added {new Date(b.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}

                      <div className="flex gap-2 border-t border-zinc-100 pt-4">
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="flex-1 rounded-xl border border-zinc-300 bg-white py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === b.id}
                          onClick={() => handleDeleteBanner(b.id)}
                          className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                        >
                          {deletingId === b.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {view === "create" && (
        <>
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to Banners List
          </button>

          <section className="admin-form-section w-full">
            <h3 className="mb-1 text-lg font-bold text-zinc-900">Add New Banner</h3>
            <p className="mb-6 text-sm text-zinc-500">Configure promotional or navigation banner details.</p>
            <form onSubmit={handleAddBanner} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Destination Link URL</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="e.g. https://youtube.com/..."
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                />
                <span className="mt-1 block text-xs text-zinc-500">URL to open when clicked</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUpload
                  file={imageFile}
                  previewUrl={previewUrl}
                  onChange={(file) => {
                    setImageFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                  }}
                  onClear={() => {
                    setImageFile(null);
                    setPreviewUrl(null);
                  }}
                />

                <div className="flex flex-col justify-center space-y-3 rounded-xl border border-zinc-200 bg-white/20 p-4">
                  <label className="text-sm font-medium text-zinc-600">Display Locations</label>
                  
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={displayPlayCarousel}
                      onChange={(e) => setDisplayPlayCarousel(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-200 bg-white text-green-500 focus:ring-green-500/20"
                    />
                    <span className="text-sm text-zinc-500">Show in Play Carousel (Homepage)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={displayEarn}
                      onChange={(e) => setDisplayEarn(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-200 bg-white text-green-500 focus:ring-green-500/20"
                    />
                    <span className="text-sm text-zinc-500">Show in Earn Tab</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Banner"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl px-6 py-3 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {view === "edit" && editingBanner && (
        <>
          <button
            type="button"
            onClick={() => { setView("list"); setEditingBanner(null); }}
            className="flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-900"
          >
            ← Back to Banners List
          </button>

          <section className="admin-form-section w-full">
            <h3 className="mb-1 text-lg font-bold text-zinc-900">Edit Banner</h3>
            <p className="mb-6 text-sm text-zinc-500">Update promotional banner details.</p>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-600">Destination Link URL</label>
                <input
                  type="text"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  placeholder="e.g. https://..."
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
                />
              </div>

              <ImageUpload
                file={editImageFile}
                previewUrl={editPreviewUrl}
                onChange={(file) => {
                  setEditImageFile(file);
                  setEditPreviewUrl(URL.createObjectURL(file));
                }}
                onClear={() => {
                  setEditImageFile(null);
                  setEditPreviewUrl(null);
                  setEditImageUrl("");
                }}
              />

              <div className="flex flex-col space-y-3 rounded-xl border border-zinc-200 bg-white/20 p-4">
                <label className="text-sm font-medium text-zinc-600">Display Locations</label>
                
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editDisplayPlayCarousel}
                    onChange={(e) => setEditDisplayPlayCarousel(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-200 bg-white text-green-500 focus:ring-green-500/20"
                  />
                  <span className="text-sm text-zinc-500">Show in Play Carousel (Homepage)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editDisplayEarn}
                    onChange={(e) => setEditDisplayEarn(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-200 bg-white text-green-500 focus:ring-green-500/20"
                  />
                  <span className="text-sm text-zinc-500">Show in Earn Tab</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => { setView("list"); setEditingBanner(null); }}
                  className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-900 rounded-xl px-6 py-3 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

function ReferralsSection() {
  const [enabled, setEnabled] = useState(false);
  const [rewardCoins, setRewardCoins] = useState(0);
  const [bannerUrl, setBannerUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [referrals, setReferrals] = useState<any[]>([]);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [settingsRes, referralsRes] = await Promise.all([
        fetch("/api/admin/referral-settings"),
        fetch("/api/admin/referrals"),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setEnabled(data.enabled);
        setRewardCoins(data.rewardCoins);
        setBannerUrl(data.bannerUrl || "");
        setPreviewUrl(data.bannerUrl || null);
      }
      if (referralsRes.ok) {
        setReferrals(await referralsRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      let finalBannerUrl = bannerUrl;
      if (imageFile) {
        finalBannerUrl = await uploadImage(imageFile);
      }
      const res = await fetch("/api/admin/referral-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, rewardCoins, bannerUrl: finalBannerUrl }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBannerUrl(finalBannerUrl);
      setPreviewUrl(finalBannerUrl || null);
      setImageFile(null);
      alert("Referral settings updated successfully!");
    } catch (err: any) {
      alert("Failed to update settings: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <AdminFormPanelSkeleton />;
  }

  return (
    <div className="space-y-8">
      <section className="admin-panel w-full">
        <h2 className="mb-2 text-base font-semibold text-zinc-900">Referral System Settings</h2>
        <p className="mb-6 text-sm text-zinc-500">Configure the behavior of your referral system.</p>
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="referralEnabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-zinc-200 bg-white text-green-500 focus:ring-green-500"
            />
            <label htmlFor="referralEnabled" className="text-sm font-medium text-zinc-600">
              Enable Referral System
            </label>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-600">Referral Reward Coins</label>
            <input
              type="number"
              min="0"
              value={rewardCoins}
              onChange={(e) => setRewardCoins(Number(e.target.value))}
              required
              className="admin-input w-full rounded-xl px-4 py-3 text-zinc-900 outline-none"
              placeholder="10"
            />
          </div>
          <ImageUpload
            file={imageFile}
            previewUrl={previewUrl}
            onChange={(file) => {
              setImageFile(file);
              setPreviewUrl(URL.createObjectURL(file));
            }}
            onClear={() => {
              setImageFile(null);
              setPreviewUrl(null);
              setBannerUrl("");
            }}
          />
          <button
            type="submit"
            disabled={savingSettings}
            className="admin-btn-primary rounded-xl px-6 py-3 font-medium disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </section>

      <section className="admin-table-panel w-full space-y-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-zinc-900">Referrals History</h2>
          <p className="mb-5 text-sm text-zinc-500">{referrals.length} referral(s) recorded</p>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 border border-zinc-200/40 rounded-xl bg-zinc-100/20">
            No referrals found
          </div>
        ) : (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="text-left">Referrer</th>
                  <th className="text-left">Referred User</th>
                  <th className="text-right">Coins Reward</th>
                  <th className="text-center">Status</th>
                  <th className="text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-zinc-900">{r.referrerName}</td>
                    <td>{r.referredName}</td>
                    <td className="text-right text-amber-300 font-bold"><CoinAmount amount={r.rewardCoins} suffix=" coins" size={14} className="justify-end" /></td>
                    <td className="text-center">
                      {r.rewardGranted ? (
                        <span className="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-zinc-900 font-medium">
                          Granted
                        </span>
                      ) : (
                        <span className="inline-block rounded bg-slate-600/20 px-2 py-0.5 text-xs text-zinc-500 font-medium">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="text-zinc-500">{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


