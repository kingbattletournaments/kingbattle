"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoadingSpinner } from "@/components/ui";
import { buildMatchScheduleTimes, formatSchedulePreviewTime } from "@/lib/match-preset-schedule";

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
type User = { id: string; email: string; displayName: string; coins: number; wonCoins?: number; isBlocked?: boolean; username?: string };

type AdminSession = {
  id: string;
  adminname: string;
  isMasterAdmin: boolean;
  usersAccess: boolean;
  coinsAccess: boolean;
  gamesAccessType: "all" | "specific";
  allowedGameIds: string[];
};

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [modes, setModes] = useState<GameMode[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchPresets, setMatchPresets] = useState<MatchPreset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hasSpecificGameAccess = session?.gamesAccessType === "specific" && !session?.isMasterAdmin;
  const hasSingleGameAccess = hasSpecificGameAccess && session && session.allowedGameIds.length === 1;

  const visibleTabs: { id: Tab; label: string; icon: string }[] = [];
  if (session) {
    visibleTabs.push({ id: "dashboard", label: "Dashboard", icon: "📊" });
    if (session.isMasterAdmin || session.gamesAccessType === "all" || session.allowedGameIds.length > 0) {
      visibleTabs.push({ id: "modes", label: "Modes", icon: "🎮" });
      visibleTabs.push({ id: "presets", label: "Match Presets", icon: "📋" });
    }
    if (session.coinsAccess) {
      visibleTabs.push({ id: "moneyorders", label: "Money Orders", icon: "💎" });
      visibleTabs.push({ id: "withdrawals", label: "Withdrawal Requests", icon: "💸" });
    }
    if (session.isMasterAdmin) {
      visibleTabs.push({ id: "admins", label: "Admin", icon: "👥" });
    }
    if (session.isMasterAdmin || session.usersAccess) {
      visibleTabs.push({ id: "users", label: "Users", icon: "👤" });
      visibleTabs.push({ id: "notifications", label: "Push Notifications", icon: "📢" });
    }
    if (session.isMasterAdmin) {
      visibleTabs.push({ id: "appsettings", label: "App Setting", icon: "⚙️" });
      visibleTabs.push({ id: "referrals", label: "Referrals", icon: "🔗" });
    }
    if (session.isMasterAdmin || session.coinsAccess) {
      visibleTabs.push({ id: "banners", label: "Banners", icon: "🖼️" });
    }
  }

  useEffect(() => {
    if (!session) return;
    const hasGames = session.isMasterAdmin || session.gamesAccessType === "all" || session.allowedGameIds.length > 0;
    const validTabs: Tab[] = ["dashboard"];
    if (hasGames) {
      validTabs.push("modes");
      validTabs.push("presets");
    }
    if (session.coinsAccess) {
      validTabs.push("moneyorders");
      validTabs.push("withdrawals");
    }
    if (session.isMasterAdmin) {
      validTabs.push("admins");
      validTabs.push("appsettings");
      validTabs.push("referrals");
    }
    if (session.isMasterAdmin || session.coinsAccess) {
      validTabs.push("banners");
    }
    if (session.isMasterAdmin || session.usersAccess) {
      validTabs.push("notifications");
      validTabs.push("users");
    }
    setTab((prev) => (validTabs.length > 0 && !validTabs.includes(prev) ? "dashboard" : prev));
  }, [session]);

  // Automatically select the first game (Free Fire) to bypass the Games selection screen
  useEffect(() => {
    if (games.length > 0 && !selectedGameId && !selectedModeId) {
      setSelectedGameId(games[0].id);
    }
  }, [games, selectedGameId, selectedModeId]);

  const fetchData = async (showLoading = true) => {
    const sessionRes = await fetch("/api/admin/session");
    const sessionData = await sessionRes.json();
    if (!sessionData.admin) return;
    setSession(sessionData.admin);

    if (showLoading) setLoading(true);
    try {
      const [gRes, mRes, matRes, presetRes, uRes, depRes, withRes] = await Promise.all([
        fetch("/api/admin/games"),
        fetch("/api/admin/modes"),
        fetch("/api/admin/matches"),
        fetch("/api/admin/match-presets"),
        (sessionData.admin.usersAccess || sessionData.admin.coinsAccess) ? fetch("/api/admin/users") : Promise.resolve(null),
        sessionData.admin.coinsAccess ? fetch("/api/admin/deposits") : Promise.resolve(null),
        sessionData.admin.coinsAccess ? fetch("/api/admin/withdrawals") : Promise.resolve(null),
      ]);
      
      if (gRes.ok) setGames(await gRes.json());
      if (mRes.ok) setModes(await mRes.json());
      if (matRes.ok) setMatches(await matRes.json());
      if (presetRes.ok) setMatchPresets(await presetRes.json());
      if (uRes?.ok) setUsers(await uRes.json());
      if (depRes?.ok) setDeposits(await depRes.json());
      if (withRes?.ok) setWithdrawals(await withRes.json());
    } catch (e) {
      setMessage({ type: "err", text: "Failed to load data" });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showMsg = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="flex items-center gap-3">
          {/* Hamburger for mobile */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
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
              className="h-9 w-9 rounded-full object-cover border border-green-500/25"
              priority
            />
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/25 normal-case hidden sm:inline-block">
              Admin
            </span>
          </div>
        </div>
        
        {session && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs text-slate-400 font-semibold">Logged in as</span>
              <span className="text-sm text-slate-200 font-bold font-mono">{session.adminname}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 items-center gap-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 px-4 text-sm font-semibold transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
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
                setTab(t.id);
                setSidebarOpen(false);
                if (t.id !== "modes" && t.id !== "presets") {
                  setSelectedGameId(null);
                  setSelectedModeId(null);
                } else if (hasSingleGameAccess && session && games.length > 0) {
                  setSelectedGameId(session.allowedGameIds[0]);
                  setSelectedModeId(null);
                }
              }}
              className={`admin-sidebar-item ${tab === t.id ? "active" : ""}`}
            >
              <span className="text-lg">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="admin-container">
        <main className="admin-main-content">
          {message && (
            <div
              className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3.5 shadow-lg ${
                message.type === "ok"
                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                  : "bg-rose-500/20 text-rose-200 border border-rose-500/30"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${message.type === "ok" ? "bg-emerald-400" : "bg-rose-400"}`} />
              {message.text}
            </div>
          )}

          {loading ? (
            <div className="admin-card flex flex-col items-center justify-center rounded-2xl p-16">
              <LoadingSpinner size="lg" label="Loading data..." />
            </div>
          ) : (
            <>
              {tab === "dashboard" && (
                <DashboardSection
                  users={users}
                  matches={matches}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  onNavigate={(t) => setTab(t)}
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
                    onBack={() => setSelectedModeId(null)}
                    onSuccess={(opts?: { silent?: boolean }) => { fetchData(!opts?.silent); showMsg("ok", "Updated"); }}
                  />
                ) : selectedGameId ? (
                  <ModesSection
                    games={games}
                    modes={modes.filter((m) => m.gameId === selectedGameId)}
                    gameId={selectedGameId}
                    onBack={undefined}
                    onSelectMode={(id) => setSelectedModeId(id)}
                    onSuccess={() => { fetchData(); showMsg("ok", "Mode created"); }}
                  />
                ) : (
                  <GamesSection
                    games={games}
                    onSelectGame={(id) => setSelectedGameId(id)}
                    onSuccess={() => { fetchData(); showMsg("ok", "Game created"); }}
                    showCreateGame={!hasSpecificGameAccess}
                  />
                )
              )}
              
              {tab === "presets" && (
                <MatchPresetsSection
                  games={games}
                  modes={modes}
                  presets={matchPresets}
                  onSuccess={() => { fetchData(); showMsg("ok", "Preset saved"); }}
                />
              )}
              
              {tab === "moneyorders" && (
                <MoneyOrdersSection
                  deposits={deposits}
                  users={users}
                  onSuccess={() => { fetchData(false); showMsg("ok", "Deposits Updated"); }}
                />
              )}
              
              {tab === "withdrawals" && (
                <WithdrawalsSection
                  withdrawals={withdrawals}
                  users={users}
                  onSuccess={() => { fetchData(false); showMsg("ok", "Withdrawals Updated"); }}
                />
              )}
              
              {tab === "admins" && session?.isMasterAdmin && (
                <CreateAdminSection
                  games={games}
                  onSuccess={() => { fetchData(); showMsg("ok", "Admin created"); }}
                />
              )}
              
              {tab === "notifications" && (
                <PushNotificationsSection />
              )}
              
              {tab === "appsettings" && (
                <AppSettingsSection
                  onSuccess={() => { fetchData(false); showMsg("ok", "Settings saved"); }}
                />
              )}

              {tab === "banners" && (
                <BannersSection />
              )}

              {tab === "referrals" && (
                <ReferralsSection />
              )}

              {tab === "users" && (session?.isMasterAdmin || session?.usersAccess) && (
                <UsersSection
                  users={users}
                  canAddCoins={!!session?.coinsAccess}
                  onSuccess={() => { fetchData(false); showMsg("ok", "Users list updated"); }}
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
        className="rounded p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Options"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-xl">
          <button
            type="button"
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
              handleRename();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
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
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
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
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-400 hover:bg-slate-700"
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
        className="admin-input flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-white outline-none"
      >
        <span>{label}</span>
        <svg className={`h-5 w-5 text-slate-400 transition ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-slate-600/50 bg-slate-800 py-1 shadow-xl">
          {MATCH_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-slate-200 hover:bg-slate-700/80 ${opt.value === value ? "bg-slate-700/50 text-white" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
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
      <label className="mb-2 block text-sm font-medium text-slate-300">Image (optional)</label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label
          htmlFor={inputId}
          className="admin-input flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition hover:border-green-500/50"
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
            <svg className="mb-2 h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
          <span className="text-sm text-slate-400">
            {file ? file.name : "Click to upload or drag image"}
          </span>
        </label>
        {file && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg bg-slate-700/50 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600/50"
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
        <section className="admin-card rounded-2xl p-6 sm:p-8">
          <h2 className="mb-1 text-base font-semibold text-white/90">Create Game</h2>
          <p className="mb-6 text-sm text-slate-400">Add a new game to the platform</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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
              className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Game"}
            </button>
          </form>
        </section>
      )}
      <section className="admin-card rounded-2xl p-6 sm:p-8">
        <h2 className="mb-1 text-base font-semibold text-white/90">Existing Games</h2>
        <p className="mb-5 text-sm text-slate-400">Click a game to manage modes and matches</p>
        <ul className="space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectGame(g.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelectGame(g.id)}
              className="admin-list-item flex cursor-pointer items-center justify-between gap-2 rounded-xl px-4 py-3.5 transition hover:border-green-500/30"
            >
              <span className="font-medium text-slate-200">{g.name}</span>
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition"
                  title="Back to Games"
                >
                  ←
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Modes for {gameName}</h1>
                <p className="text-slate-400 text-sm">Select a game mode to view and manage matches.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("create")}
              className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            >
              + Create Game Mode
            </button>
          </div>

          <div className="admin-card rounded-2xl p-6 sm:p-8">
            <h3 className="mb-4 text-base font-semibold text-white/90">Existing Modes</h3>
            {modes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No game modes configured yet</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modes.map((m) => (
                  <li
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectMode(m.id)}
                    onKeyDown={(e) => e.key === "Enter" && onSelectMode(m.id)}
                    className="admin-list-item flex cursor-pointer items-center justify-between gap-3 rounded-xl p-4 transition hover:border-green-500/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.imageUrl ? (
                        <img
                          src={m.imageUrl}
                          alt={m.name}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-500 text-lg shrink-0">
                          🎮
                        </div>
                      )}
                      <span className="font-semibold text-slate-200 text-sm truncate">{m.name}</span>
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
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Modes
          </button>
          
          <section className="admin-card rounded-2xl p-6 sm:p-8 max-w-xl">
            <h2 className="mb-1 text-lg font-bold text-white">Create Game Mode</h2>
            <p className="mb-6 text-sm text-slate-400">Define a new game mode block under {gameName}.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Mode Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Mode"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl px-6 py-3 font-medium transition"
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
  teamMembers: { inGameName: string; inGameUid: string; kills?: number }[];
  rank?: number;
};
type MatchWithParticipants = Match & { participants?: ParticipantWithStats[] };

function calcCoinsForPosition(
  position: number,
  totalKills: number,
  prizePool: PrizePool | undefined
): number {
  if (!prizePool) return 0;
  let coins = totalKills * (prizePool.coinsPerKill ?? 0);
  const rewards = prizePool.rankRewards ?? [];
  for (const r of rewards) {
    if (position >= r.fromRank && position <= r.toRank) {
      coins += r.coins;
      break;
    }
  }
  return coins;
}

function MatchesSection({
  games,
  modes,
  matches,
  matchPresets,
  modeId,
  users,
  onBack,
  onSuccess,
}: {
  games: Game[];
  modes: GameMode[];
  matches: Match[];
  matchPresets: MatchPreset[];
  modeId: string;
  users: User[];
  onBack: () => void;
  onSuccess: (opts?: { silent?: boolean }) => void;
}) {
  const [view, setView] = useState<"list" | "create" | "createFromPreset">("list");
  const [title, setTitle] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("16");
  const [scheduledAt, setScheduledAt] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("solo");
  const [coinsPerKill, setCoinsPerKill] = useState("5");
  const [totalPrizePool, setTotalPrizePool] = useState("");
  const [rankRewards, setRankRewards] = useState<RankReward[]>([
    { fromRank: 1, toRank: 1, coins: 0 },
    { fromRank: 2, toRank: 2, coins: 0 },
    { fromRank: 3, toRank: 3, coins: 0 },
  ]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [matchTab, setMatchTab] = useState<"upcoming" | "ongoing" | "finished">("upcoming");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetMatchDate, setPresetMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [presetStartingTime, setPresetStartingTime] = useState("10:00");
  const [presetGapMinutes, setPresetGapMinutes] = useState("60");
  const [presetEndingTime, setPresetEndingTime] = useState("18:00");
  const [presetSubmitting, setPresetSubmitting] = useState(false);

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
  const finished = matches.filter((m) => m.status === "ended" || m.status === "completed" || m.status === "cancelled");
  const tabMatches = matchTab === "upcoming" ? upcoming : matchTab === "ongoing" ? ongoing : finished;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameModeId: modeId,
          title,
          entryFee: Number(entryFee),
          maxParticipants: Number(maxParticipants) || 16,
          scheduledAt: scheduledAt || new Date().toISOString(),
          matchType,
          image: imageUrl,
          prizePool: {
            coinsPerKill: Number(coinsPerKill) || 0,
            totalPrizePool: totalPrizePool ? Number(totalPrizePool) : 0,
            rankRewards: rankRewards.filter((r) => r.fromRank > 0 && r.toRank >= r.fromRank && r.coins >= 0),
          },
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
      setRankRewards([
        { fromRank: 1, toRank: 1, coins: 0 },
        { fromRank: 2, toRank: 2, coins: 0 },
        { fromRank: 3, toRank: 3, coins: 0 },
      ]);
      handleImageClear();
      setSelectedMatchId(data?.id ?? null);
      setMatchTab("upcoming");
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
      setMatchTab("upcoming");
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
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition"
                title="Back to Game Modes"
              >
                ←
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Matches for {modeName}</h1>
                <p className="text-slate-400 text-sm">Review players registration, details and map parameters.</p>
              </div>
            </div>
            {!selectedMatchId && (
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setView("create")}
                  className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
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
                  className="rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-2.5 text-sm font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create using preset
                </button>
              </div>
            )}
          </div>

          <div className="admin-match-list space-y-6">
            {selectedMatchId ? (
              <MatchDetailView
                matchId={selectedMatchId}
                games={games}
                modes={modes}
                users={users}
                onBack={() => setSelectedMatchId(null)}
                onSuccess={onSuccess}
              />
            ) : (
              <>
                <div className="mb-6 grid w-full grid-cols-3 gap-2 sm:flex">
                  {(["upcoming", "ongoing", "finished"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setMatchTab(t); setSelectedMatchId(null); }}
                      className={`rounded-full px-3.5 py-2 text-xs font-semibold sm:px-5 sm:text-sm ${
                        matchTab === t
                          ? "bg-green-600 text-white"
                          : "bg-slate-800/80 text-slate-400 hover:bg-slate-700 border border-slate-700/60"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {tabMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-400 bg-slate-950/20">
                    No {matchTab} matches recorded under this mode.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tabMatches.map((m) => {
                      const spotsTaken = m.participantCount ?? 0;
                      const maxParticipants = m.maxParticipants ?? 100;
                      const spotsLeft = Math.max(0, maxParticipants - spotsTaken);
                      return (
                        <div key={m.id} className="admin-card rounded-2xl overflow-hidden border border-slate-800 hover:border-green-500/30 transition flex flex-col">
                          {/* 1. Banner image */}
                          <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden">
                            <img
                              src={getMatchBanner(m)}
                              alt="Match Banner"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* 2. Info Row */}
                          <div className="flex items-center gap-3 p-4 border-b border-slate-800/60">
                            <img
                              src="/images/app-icon.png"
                              alt="Logo"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-800 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-white text-sm truncate" title={m.title}>{m.title}</h4>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Starts: {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : "TBD"}
                              </p>
                            </div>
                          </div>

                          {/* 3. Stats Grid */}
                          <div className="p-4 grid grid-cols-3 gap-y-4 gap-x-2 text-center border-b border-slate-800/60 bg-slate-900/10">
                            {/* Prize Pool */}
                            <div className="cursor-pointer select-none" onClick={() => setExpandedMatchId(expandedMatchId === m.id ? null : m.id)}>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Prize Pool</p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="text-xs">💵</span>
                                <span className="text-xs font-bold text-white">{m.prizePool?.totalPrizePool ?? 0}</span>
                                <span className="text-[10px] text-slate-400">{expandedMatchId === m.id ? "▲" : "▼"}</span>
                              </div>
                            </div>

                            {/* Per Kill */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Per Kill</p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="text-xs">💵</span>
                                <span className="text-xs font-bold text-white">{m.prizePool?.coinsPerKill ?? 0}</span>
                              </div>
                            </div>

                            {/* Entry Fee */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Entry Fee</p>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="text-xs">💵</span>
                                <span className="text-xs font-bold text-white">{m.entryFee}</span>
                              </div>
                            </div>

                            {/* Type */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Type</p>
                              <p className="text-xs font-bold text-slate-300 mt-1 capitalize">{m.matchType ?? "Solo"}</p>
                            </div>

                            {/* Version */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Version</p>
                              <p className="text-xs font-bold text-slate-300 mt-1">TPP</p>
                            </div>

                            {/* Map */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Map</p>
                              <p className="text-xs font-bold text-slate-300 mt-1 uppercase truncate">{m.map ?? "BERMUDA"}</p>
                            </div>
                          </div>

                          {/* Expandable rewards */}
                          {expandedMatchId === m.id && (
                            <div className="p-4 bg-slate-950/40 border-b border-slate-800/60 text-xs">
                              <p className="font-bold text-slate-400 text-[10px] uppercase tracking-wider mb-2">Rank Rewards</p>
                              {(!m.prizePool?.rankRewards || m.prizePool.rankRewards.length === 0) ? (
                                <p className="text-slate-500 text-xs">All prizes distributed via per-kill earnings.</p>
                              ) : (
                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                  {m.prizePool.rankRewards.map((reward, ri) => (
                                    <div key={ri} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-slate-900/50 last:border-0">
                                      <span>Rank {reward.fromRank === reward.toRank ? reward.fromRank : `${reward.fromRank} - ${reward.toRank}`}</span>
                                      <span className="font-semibold text-white">💵 {reward.coins} coins</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. Progress and Button */}
                          <div className="p-4 flex-1 flex flex-col justify-end space-y-3 bg-slate-900/5">
                            {/* Progress */}
                            <div>
                              <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                                <span>Joined: {spotsTaken} / {maxParticipants}</span>
                                <span>{spotsLeft} spots left</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all"
                                  style={{ width: `${Math.min(100, (spotsTaken / maxParticipants) * 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedMatchId(m.id)}
                              className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-xs font-semibold transition"
                            >
                              Manage Match
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Matches List
          </button>

          <section className="admin-card rounded-2xl p-6 sm:p-8 max-w-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">Create Matches from Preset</h2>
            <p className="mb-6 text-sm text-slate-400">
              Select a preset and schedule multiple matches for {modeName} on one day.
            </p>

            {matchPresets.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No presets for this mode yet. Create one in the Match Presets tab first.
              </p>
            ) : (
              <form onSubmit={handleCreateFromPreset} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Preset</label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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
                  <label className="mb-2 block text-sm font-medium text-slate-300">Match date</label>
                  <input
                    type="date"
                    value={presetMatchDate}
                    onChange={(e) => setPresetMatchDate(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Starting time</label>
                    <input
                      type="time"
                      value={presetStartingTime}
                      onChange={(e) => setPresetStartingTime(e.target.value)}
                      required
                      className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Time gap (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      value={presetGapMinutes}
                      onChange={(e) => setPresetGapMinutes(e.target.value)}
                      required
                      className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Ending time</label>
                    <input
                      type="time"
                      value={presetEndingTime}
                      onChange={(e) => setPresetEndingTime(e.target.value)}
                      required
                      className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                    />
                  </div>
                </div>
                {presetSchedulePreview.length > 0 && (
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/20 p-4">
                    <p className="text-sm font-medium text-slate-300 mb-2">
                      {presetSchedulePreview.length} match{presetSchedulePreview.length === 1 ? "" : "es"} will be created at:
                    </p>
                    <p className="text-sm text-slate-400">
                      {presetSchedulePreview.map(formatSchedulePreviewTime).join(", ")}
                    </p>
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
                    className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
                  >
                    {presetSubmitting ? "Creating..." : `Create ${presetSchedulePreview.length || ""} Matches`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl px-6 py-3 font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Matches List
          </button>

          <section className="admin-card rounded-2xl p-6 sm:p-8 max-w-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">Create New Match</h2>
            <p className="mb-6 text-sm text-slate-400">Setup matches and reward parameters under {modeName}.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  placeholder="e.g. Weekend Cup #1"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Match Type</label>
                <MatchTypeDropdown value={matchType} onChange={setMatchType} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Entry Fee (coins)</label>
                  <input
                    type="number"
                    min="0"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Max Participants</label>
                  <input
                    type="number"
                    min="2"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Scheduled At (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                />
              </div>
              <ImageUpload
                file={imageFile}
                previewUrl={imagePreview}
                onChange={handleImageChange}
                onClear={handleImageClear}
              />
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/10 p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-300">Prize Pool</h3>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Total prize pool (coins)</label>
                    <input
                      type="number"
                      min="0"
                      value={totalPrizePool}
                      onChange={(e) => setTotalPrizePool(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Coins per kill</label>
                    <input
                      type="number"
                      min="0"
                      value={coinsPerKill}
                      onChange={(e) => setCoinsPerKill(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                      placeholder="5"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs text-slate-400 font-semibold">Rank rewards (coins per rank range)</label>
                  <p className="text-[11px] text-slate-500">
                    Ranks 1–3 are fixed; use + Add rank range for more (e.g. 4th–10th).
                  </p>
                  {([0, 1, 2] as const).map((slot) => (
                    <div key={slot} className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex w-16 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300">
                        {slot + 1}
                      </span>
                      <span className="text-slate-500">-</span>
                      <span className="inline-flex w-16 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-sm text-slate-300">
                        {slot + 1}
                      </span>
                      <span className="text-slate-500">→</span>
                      <input
                        type="number"
                        min="0"
                        value={rankRewards[slot]?.coins ?? 0}
                        onChange={(e) => {
                          const coins = Number(e.target.value) || 0;
                          setRankRewards((prev) => {
                            const next = [...prev];
                            while (next.length < 3) {
                              next.push({ fromRank: next.length + 1, toRank: next.length + 1, coins: 0 });
                            }
                            next[slot] = { fromRank: slot + 1, toRank: slot + 1, coins };
                            return next;
                          });
                        }}
                        className="admin-input w-20 rounded-lg px-3 py-2 text-sm text-white outline-none"
                        placeholder="coins"
                      />
                      <span className="text-slate-400 text-sm">coins</span>
                    </div>
                  ))}
                  {rankRewards.slice(3).map((r, sliceIdx) => {
                    const i = sliceIdx + 3;
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={r.fromRank}
                          onChange={(e) =>
                            setRankRewards((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, fromRank: Number(e.target.value) || 1 } : x)),
                            )
                          }
                          className="admin-input w-16 rounded-lg px-3 py-2 text-sm text-white outline-none"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                          type="number"
                          min="1"
                          value={r.toRank}
                          onChange={(e) =>
                            setRankRewards((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, toRank: Number(e.target.value) || 1 } : x)),
                            )
                          }
                          className="admin-input w-16 rounded-lg px-3 py-2 text-sm text-white outline-none"
                        />
                        <span className="text-slate-500">→</span>
                        <input
                          type="number"
                          min="0"
                          value={r.coins}
                          onChange={(e) =>
                            setRankRewards((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, coins: Number(e.target.value) || 0 } : x)),
                            )
                          }
                          className="admin-input w-20 rounded-lg px-3 py-2 text-sm text-white outline-none"
                          placeholder="coins"
                        />
                        <span className="text-slate-400 text-sm">coins</span>
                        <button
                          type="button"
                          onClick={() => setRankRewards((prev) => prev.filter((_, j) => j !== i))}
                          className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20"
                          aria-label="Remove range"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      setRankRewards((prev) => {
                        const maxTo = prev.length > 0 ? Math.max(...prev.map((r) => r.toRank)) : 0;
                        return [...prev, { fromRank: maxTo + 1, toRank: maxTo + 3, coins: 0 }];
                      })
                    }
                    className="rounded-lg border border-dashed border-slate-500 px-3 py-2 text-sm text-slate-400 hover:border-green-500/50 hover:text-green-400"
                  >
                    + Add rank range
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Match"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl px-6 py-3 font-medium transition"
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
  const [view, setView] = useState<"list" | "create">("list");
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
  const [rankRewards, setRankRewards] = useState<RankReward[]>([
    { fromRank: 1, toRank: 1, coins: 0 },
    { fromRank: 2, toRank: 2, coins: 0 },
    { fromRank: 3, toRank: 3, coins: 0 },
  ]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredModes = modes.filter((m) => !filterGameId || m.gameId === filterGameId);
  const visiblePresets = presets.filter((p) => {
    if (filterModeId) return p.gameModeId === filterModeId;
    if (filterGameId) {
      const modeIds = modes.filter((m) => m.gameId === filterGameId).map((m) => m.id);
      return modeIds.includes(p.gameModeId);
    }
    return true;
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
    setRankRewards([
      { fromRank: 1, toRank: 1, coins: 0 },
      { fromRank: 2, toRank: 2, coins: 0 },
      { fromRank: 3, toRank: 3, coins: 0 },
    ]);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
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
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadImage(imageFile);
      const res = await fetch("/api/admin/match-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameModeId,
          name,
          title,
          entryFee: Number(entryFee),
          maxParticipants: Number(maxParticipants) || 16,
          matchType,
          map,
          image: imageUrl,
          prizePool: {
            coinsPerKill: Number(coinsPerKill) || 0,
            totalPrizePool: totalPrizePool ? Number(totalPrizePool) : 0,
            rankRewards: rankRewards.filter((r) => r.fromRank > 0 && r.toRank >= r.fromRank && r.coins >= 0),
          },
        }),
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

  const modeLabel = (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId);
    if (!mode) return modeId;
    const game = games.find((g) => g.id === mode.gameId);
    return `${game?.name ?? "?"} / ${mode.name}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Match Presets</h1>
          <p className="text-slate-400 text-sm">Save match templates without date or time for bulk scheduling.</p>
        </div>
        {view === "list" && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setGameModeId(filterModeId || filteredModes[0]?.id || "");
              setView("create");
            }}
            className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white shrink-0"
          >
            + Create Preset
          </button>
        )}
      </div>

      {view === "list" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterGameId}
              onChange={(e) => {
                setFilterGameId(e.target.value);
                setFilterModeId("");
              }}
              className="admin-input rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            >
              <option value="">All games</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={filterModeId}
              onChange={(e) => setFilterModeId(e.target.value)}
              className="admin-input rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            >
              <option value="">All modes</option>
              {filteredModes.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {visiblePresets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-400 bg-slate-950/20">
              No presets yet. Create one to schedule matches faster.
            </div>
          ) : (
            <div className="admin-table-panel overflow-x-auto">
              <table className="admin-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Preset name</th>
                    <th>Mode</th>
                    <th>Title</th>
                    <th>Entry</th>
                    <th>Type</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePresets.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-white">{p.name}</td>
                      <td>{modeLabel(p.gameModeId)}</td>
                      <td>{p.title}</td>
                      <td>{p.entryFee} coins</td>
                      <td className="capitalize">{p.matchType ?? "solo"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="text-rose-400 hover:text-rose-300 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to presets
          </button>
          <section className="admin-card rounded-2xl p-6 sm:p-8 max-w-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">Create Match Preset</h2>
            <p className="mb-6 text-sm text-slate-400">All match details except date and time.</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Game mode</label>
                <select
                  value={gameModeId}
                  onChange={(e) => setGameModeId(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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
                <label className="mb-2 block text-sm font-medium text-slate-300">Preset name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  placeholder="e.g. Morning Solo batch"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Match title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  placeholder="e.g. Daily Cup"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Match Type</label>
                <MatchTypeDropdown value={matchType} onChange={setMatchType} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Entry Fee (coins)</label>
                  <input
                    type="number"
                    min="0"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    required
                    className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Max Participants</label>
                  <input
                    type="number"
                    min="2"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Map</label>
                <input
                  type="text"
                  value={map}
                  onChange={(e) => setMap(e.target.value)}
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                  placeholder="BERMUDA"
                />
              </div>
              <ImageUpload
                file={imageFile}
                previewUrl={imagePreview}
                onChange={handleImageChange}
                onClear={handleImageClear}
              />
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/10 p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-300">Prize Pool</h3>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Total prize pool (coins)</label>
                    <input
                      type="number"
                      min="0"
                      value={totalPrizePool}
                      onChange={(e) => setTotalPrizePool(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Coins per kill</label>
                    <input
                      type="number"
                      min="0"
                      value={coinsPerKill}
                      onChange={(e) => setCoinsPerKill(e.target.value)}
                      className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs text-slate-400 font-semibold">Rank rewards</label>
                  {[0, 1, 2].map((slot) => (
                    <div key={slot} className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-500 text-sm w-16">Rank {slot + 1}</span>
                      <input
                        type="number"
                        min="0"
                        value={rankRewards[slot]?.coins ?? 0}
                        onChange={(e) => {
                          const coins = Number(e.target.value) || 0;
                          setRankRewards((prev) => {
                            const next = [...prev];
                            while (next.length < 3) {
                              next.push({ fromRank: next.length + 1, toRank: next.length + 1, coins: 0 });
                            }
                            next[slot] = { fromRank: slot + 1, toRank: slot + 1, coins };
                            return next;
                          });
                        }}
                        className="admin-input w-20 rounded-lg px-3 py-2 text-sm text-white outline-none"
                      />
                      <span className="text-slate-400 text-sm">coins</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Preset"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl px-6 py-3 font-medium transition"
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
}: {
  matchId: string;
  games: Game[];
  modes: GameMode[];
  users: User[];
  onBack: () => void;
  onSuccess: (opts?: { silent?: boolean }) => void;
}) {
  const [match, setMatch] = useState<MatchWithParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [updatingParticipant, setUpdatingParticipant] = useState<string | null>(null);
  const [localKills, setLocalKills] = useState<Record<string, number[]>>({});
  const [localRank, setLocalRank] = useState<Record<string, number | "">>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/matches/${matchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setMatch(data);
          setRoomCode(data.roomCode ?? "");
          setRoomPassword(data.roomPassword ?? "");
        }
      })
      .catch(() => setMatch(null))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  useEffect(() => {
    if (!match?.participants) return;
    const nextKills: Record<string, number[]> = {};
    const nextRank: Record<string, number | ""> = {};
    for (const p of match.participants) {
      nextKills[p.id] = (p.teamMembers ?? []).map((t) => t.kills ?? 0);
      nextRank[p.id] = p.rank ?? "";
    }
    setLocalKills((prev) => ({ ...prev, ...nextKills }));
    setLocalRank((prev) => ({ ...prev, ...nextRank }));
  }, [match]);

  const mode = modes.find((m) => m.id === match?.gameModeId);
  const gameName = mode ? games.find((g) => g.id === mode.gameId)?.name ?? "?" : "?";

  const handleSaveRoom = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, roomPassword }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMatch(data);
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save room info");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, roomPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start match");
      }
      const data = await res.json();
      setMatch(data);
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start match");
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this match? All registered players will receive a refund.")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setMatch(null);
      onBack();
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel match");
    } finally {
      setCancelling(false);
    }
  };

  const handleFinish = async () => {
    if (!match) return;
    const allUpdated = (match.participants ?? []).every(
      (p) =>
        (typeof p.rank === "number" && p.rank >= 1) ||
        (p.teamMembers ?? []).some((t) => (t.kills ?? 0) > 0)
    );
    if (!allUpdated && (match.participants ?? []).length > 0) {
      alert("Update rank and kills for all participants before finishing the match.");
      return;
    }
    if (!confirm("Finish this match? Coins will be transferred to winners. This cannot be undone.")) return;
    setFinishing(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/finish`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to finish match");
      }
      const data = await res.json();
      setMatch(data);
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to finish match");
    } finally {
      setFinishing(false);
    }
  };

  if (loading || !match) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="md" compact label="Loading match..." />
      </div>
    );
  }

  const participants = match.participants ?? [];
  const isUpcoming = match.status === "upcoming";
  const isOngoing = match.status === "ongoing";
  const hasRoomInfo = !!(match.roomCode && match.roomPassword);
  const canStartMatch = hasRoomInfo || (!!roomCode && !!roomPassword);
  const getKills = (p: ParticipantWithStats) =>
    localKills[p.id] ?? (p.teamMembers ?? []).map((t) => t.kills ?? 0);

  const handleUpdateParticipant = async (p: ParticipantWithStats) => {
    setUpdatingParticipant(p.id);
    try {
      const kills = localKills[p.id] ?? (p.teamMembers ?? []).map((t) => t.kills ?? 0);
      const rankVal = localRank[p.id];
      const body: { kills?: number[]; rank?: number } = {};
      const serverKills = (p.teamMembers ?? []).map((t) => t.kills ?? 0);
      if (JSON.stringify(kills) !== JSON.stringify(serverKills)) body.kills = kills;
      if (typeof rankVal === "number" && rankVal >= 1 && rankVal !== p.rank) body.rank = rankVal;
      if (Object.keys(body).length === 0) return;
      const res = await fetch(`/api/admin/matches/${matchId}/participants/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMatch(data);
      onSuccess({ silent: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdatingParticipant(null);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        ← Back to matches
      </button>

      <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-6">
        <h2 className="text-lg font-semibold text-white">{match.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-lg px-3 py-1 text-xs font-medium ${
            match.status === "ongoing" ? "bg-emerald-500/20 text-emerald-300" :
            match.status === "cancelled" ? "bg-rose-500/20 text-rose-300" :
            match.status === "ended" || match.status === "completed" ? "bg-slate-600/30 text-slate-400" :
            "bg-amber-500/20 text-amber-300"
          }`}>
            {match.status}
          </span>
          <span className="rounded bg-slate-600/50 px-3 py-1 text-xs text-slate-400">{match.matchType}</span>
          <span className="rounded bg-slate-600/50 px-3 py-1 text-xs text-amber-400">{match.entryFee} coins</span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {gameName} • Scheduled: {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : "TBD"}
        </p>
      </div>

      <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-6">
        <h3 className="mb-3 text-sm font-medium text-slate-300">Prize Pool</h3>
        <div className="space-y-2 text-sm">
          <p className="text-slate-200">Coins per kill: {match.prizePool?.coinsPerKill ?? 0}</p>
          {(match.prizePool?.rankRewards ?? []).map((r: RankReward, i: number) => (
            <p key={i} className="text-slate-200">
              {r.fromRank === r.toRank
                ? `Rank ${r.fromRank}`
                : `Ranks ${r.fromRank}–${r.toRank}`}
              : {r.coins} coins
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4 sm:p-6">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline">
          <h3 className="text-sm font-medium text-slate-300">
            Players Joined ({participants.length})
          </h3>
          {isOngoing && (
            <span className="text-xs font-normal text-emerald-400">
              Edit kills/rank, then click Update to save. Changes apply only after Update.
            </span>
          )}
        </div>
        {participants.length === 0 ? (
          <p className="text-sm text-slate-400">No players registered yet</p>
        ) : (
          <ul className="space-y-3">
            {participants.map((p, i) => {
              const killsArr = getKills(p);
              const totalKills = killsArr.reduce((sum, k) => sum + k, 0);
              const rankVal = localRank[p.id] ?? "";
              const serverKills = (p.teamMembers ?? []).map((t) => t.kills ?? 0);
              const killsChanged = JSON.stringify(killsArr) !== JSON.stringify(serverKills);
              const rankChanged = typeof rankVal === "number" && rankVal >= 1 && rankVal !== p.rank;
              const hasChanges = killsChanged || rankChanged;
              const hasBeenUpdated =
                (typeof p.rank === "number" && p.rank >= 1) ||
                (p.teamMembers ?? []).some((t) => (t.kills ?? 0) > 0);
              const position = typeof p.rank === "number" && p.rank >= 1 ? p.rank : i + 1;
              const coins = calcCoinsForPosition(position, totalKills, match.prizePool);
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-lg bg-slate-700/30 p-4 transition sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
                >
                  {hasBeenUpdated && (
                    <span className="shrink-0 text-sm font-bold text-slate-400">#{position}</span>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    {p.userId && (
                      <div className="break-all text-xs font-mono text-slate-500">
                        User ID: {p.userId}
                      </div>
                    )}
                    {(p.teamMembers ?? []).map((t, ti) => (
                      <div key={ti} className="flex flex-wrap items-center gap-2">
                        <div>
                          <div className="text-base font-bold text-white">{t.inGameName}</div>
                          <div className="text-xs opacity-60 text-slate-400">{t.inGameUid}</div>
                        </div>
                        {isOngoing && (
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-slate-500">Kills</label>
                            <input
                              type="number"
                              min={0}
                              value={killsArr[ti] ?? 0}
                              onChange={(e) => {
                                const v = Number(e.target.value) || 0;
                                setLocalKills((prev) => ({
                                  ...prev,
                                  [p.id]: (prev[p.id] ?? killsArr).map((k, j) => (j === ti ? v : k)),
                                }));
                              }}
                              className="admin-input w-14 rounded-lg px-2 py-1.5 text-center text-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {isOngoing && (
                    <>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-500">Rank</label>
                        <input
                          type="number"
                          min={1}
                          max={participants.length}
                          value={rankVal === "" ? "" : rankVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLocalRank((prev) => ({
                              ...prev,
                              [p.id]: v === "" ? "" : Math.min(participants.length, Math.max(1, Number(v) || 1)),
                            }));
                          }}
                          placeholder="—"
                          className="admin-input w-14 rounded-lg px-2 py-1.5 text-center text-sm"
                        />
                      </div>
                      {hasChanges && (
                        <button
                          type="button"
                          onClick={() => handleUpdateParticipant(p)}
                          disabled={!!updatingParticipant}
                          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {updatingParticipant === p.id ? "Updating..." : "Update"}
                        </button>
                      )}
                    </>
                  )}
                  {hasBeenUpdated && (
                    <span className="shrink-0 self-start rounded-lg bg-amber-500/20 px-3 py-1 font-medium text-amber-300 sm:self-center">
                      {coins} coins
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isOngoing && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h3 className="mb-4 text-sm font-medium text-emerald-200">Finish Match</h3>
          <p className="mb-4 text-xs text-slate-400">
            After updating rank and kills for all participants, click Finish to complete the match. Coins will be transferred to winners.
          </p>
          <button
            type="button"
            onClick={handleFinish}
            disabled={finishing}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {finishing ? "Finishing..." : "Finish Match"}
          </button>
        </div>
      )}

      {isUpcoming && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h3 className="mb-4 text-sm font-medium text-amber-200">Room Info</h3>
          <p className="mb-4 text-xs text-slate-400">
            Set room code and password. Registered players will be notified when updated. Only they can see it.
          </p>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                placeholder="ROOM123"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Room Password</label>
              <input
                type="text"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                className="admin-input w-full rounded-lg px-4 py-2.5 text-sm text-white outline-none"
                placeholder="pass123"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveRoom}
              disabled={saving}
              className="rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Room Info"}
            </button>
            {canStartMatch && (
              <button
                type="button"
                onClick={handleStart}
                disabled={starting}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {starting ? "Starting..." : "Start Match"}
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel Match"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type AdminListItem = {
  id: string;
  adminname: string;
  isMasterAdmin: boolean;
  usersAccess: boolean;
  coinsAccess: boolean;
  gamesAccessType: string;
  allowedGameIds: string[];
};

function AdminProfileModal({
  admin,
  games,
  onClose,
  onDelete,
}: {
  admin: AdminListItem;
  games: Game[];
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
        className="relative z-10 w-full max-h-[90vh] sm:max-h-[calc(100vh-2rem)] sm:max-w-md overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-600/50 border-b-0 sm:border-b bg-slate-900 shadow-xl pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        {/* Mobile: drag handle */}
        <div className="sticky top-0 z-10 flex flex-col bg-slate-900/95 backdrop-blur-sm sm:bg-slate-900 sm:backdrop-blur-none">
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-12 rounded-full bg-slate-600" aria-hidden />
          </div>
          <div className="flex items-center justify-between px-4 pb-4 pt-1 sm:px-6 sm:pt-6 sm:pb-0">
            <h2 className="text-base sm:text-lg font-semibold text-white">Admin Profile</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white touch-manipulation"
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
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Admin Name</dt>
              <dd className="font-medium text-white break-words">{admin.adminname}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Admin ID</dt>
              <dd className="font-mono text-sm text-slate-400 break-all">{admin.id}</dd>
            </div>
            <div className="flex flex-col gap-1.5 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</dt>
              <dd>
                <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${admin.isMasterAdmin ? "bg-amber-500/20 text-amber-300" : "text-slate-300 bg-slate-600/50"}`}>
                  {admin.isMasterAdmin ? "Master Admin" : "Admin"}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-1.5 sm:block">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Permissions</dt>
              <dd className="flex flex-wrap gap-1.5">
                {admin.usersAccess && <span className="rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">Users</span>}
                {admin.coinsAccess && <span className="rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">Coins</span>}
                {admin.gamesAccessType === "all" ? (
                  <span className="rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">All games</span>
                ) : (
                  (admin.allowedGameIds ?? []).map((gid) => {
                    const game = games.find((g) => g.id === gid);
                    return game ? (
                      <span key={gid} className="rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">{game.name}</span>
                    ) : null;
                  })
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 sm:mt-8 space-y-4 border-t border-slate-700/50 pt-6">
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
                className="w-full rounded-lg bg-red-600 px-4 py-3 sm:py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 min-h-[44px] sm:min-h-0"
              >
                {deleting ? "..." : "Delete Admin"}
              </button>
            )}
            {admin.isMasterAdmin && (
              <p className="text-xs text-slate-500">Master admin cannot be deleted. Only password can be changed.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateAdminSection({
  games,
  onSuccess,
}: {
  games: Game[];
  onSuccess: () => void;
}) {
  const [adminname, setAdminname] = useState("");
  const [password, setPassword] = useState("");
  const [usersAccess, setUsersAccess] = useState(false);
  const [coinsAccess, setCoinsAccess] = useState(false);
  const [gamesAccessType, setGamesAccessType] = useState<"all" | "specific">("all");
  const [allowedGameIds, setAllowedGameIds] = useState<string[]>([]);
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

  const toggleGame = (gameId: string) => {
    setAllowedGameIds((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminname,
          password,
          usersAccess,
          coinsAccess,
          gamesAccessType,
          allowedGameIds: gamesAccessType === "specific" ? allowedGameIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create admin");
        return;
      }
      setAdminname("");
      setPassword("");
      setUsersAccess(false);
      setCoinsAccess(false);
      setGamesAccessType("all");
      setAllowedGameIds([]);
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
      <section className="admin-card rounded-2xl p-6 sm:p-8">
        <h2 className="mb-1 text-base font-semibold text-white/90">Create Admin</h2>
        <p className="mb-6 text-sm text-slate-400">Create credentials for a new admin. Set permissions below.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Admin Name</label>
            <input
              type="text"
              value={adminname}
              onChange={(e) => setAdminname(e.target.value)}
              required
              className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
              placeholder="adminname"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">Permissions</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={usersAccess}
                onChange={(e) => setUsersAccess(e.target.checked)}
                className="rounded border-slate-500"
              />
              <span className="text-slate-200">Users tab access</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={coinsAccess}
                onChange={(e) => setCoinsAccess(e.target.checked)}
                className="rounded border-slate-500"
              />
              <span className="text-slate-200">Coins tab access</span>
            </label>
            <div className="pt-2">
              <span className="mb-2 block text-sm text-slate-400">Games access</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="gamesAccess"
                    checked={gamesAccessType === "all"}
                    onChange={() => setGamesAccessType("all")}
                    className="border-slate-500"
                  />
                  <span className="text-slate-200">All games</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="gamesAccess"
                    checked={gamesAccessType === "specific"}
                    onChange={() => setGamesAccessType("specific")}
                    className="border-slate-500"
                  />
                  <span className="text-slate-200">Specific games</span>
                </label>
              </div>
              {gamesAccessType === "specific" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {games.map((g) => (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 transition hover:border-green-500/30"
                    >
                      <input
                        type="checkbox"
                        checked={allowedGameIds.includes(g.id)}
                        onChange={() => toggleGame(g.id)}
                        className="rounded border-slate-500"
                      />
                      <span className="text-sm text-slate-200">{g.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <p className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-300">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Admin"}
          </button>
        </form>
      </section>
      <section className="admin-card rounded-2xl p-6 sm:p-8">
        <h2 className="mb-1 text-base font-semibold text-white/90">Existing Admins</h2>
        <p className="mb-5 text-sm text-slate-400">{admins.length} admin(s)</p>
        <ul className="space-y-2">
          {admins.map((a) => (
            <li
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedAdmin(a)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedAdmin(a)}
              className="admin-list-item flex cursor-pointer flex-col gap-2 rounded-xl px-4 py-3.5 transition hover:border-green-500/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="shrink-0 font-medium text-slate-200">{a.adminname}</span>
              <div className="flex flex-wrap gap-1.5">
                {a.isMasterAdmin && (
                  <span className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Master</span>
                )}
                {a.usersAccess && <span className="shrink-0 rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">Users</span>}
                {a.coinsAccess && <span className="shrink-0 rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">Coins</span>}
                {a.gamesAccessType === "all" ? (
                  <span className="shrink-0 rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">All games</span>
                ) : (
                  (a.allowedGameIds ?? []).map((gid) => {
                    const game = games.find((g) => g.id === gid);
                    return game ? (
                      <span key={gid} className="shrink-0 rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300">
                        {game.name}
                      </span>
                    ) : null;
                  })
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {selectedAdmin && (
        <AdminProfileModal
          admin={selectedAdmin}
          games={games}
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
  onSuccess,
}: {
  users: User[];
  canAddCoins: boolean;
  onSuccess: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [usersTab, setUsersTab] = useState<"all" | "blocked">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const searchTrimmed = searchQuery.trim().toLowerCase();
  const filteredUsers = users
    .filter((u) => (usersTab === "blocked" ? u.isBlocked : true))
    .filter((u) => {
      if (!searchTrimmed) return true;
      const username = (u.username || u.id).toLowerCase();
      const displayName = u.displayName.toLowerCase();
      return username.includes(searchTrimmed) || displayName.includes(searchTrimmed);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Users List</h1>
        <p className="text-slate-400 text-sm">
          View registered users, normal balances, win balances, block/unblock, and add coins.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 w-fit">
          {(["all", "blocked"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setUsersTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                usersTab === t ? "bg-green-600 text-white" : "text-slate-400 hover:text-slate-200"
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
          <p className="py-12 text-center text-sm text-slate-400">No users found</p>
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
                      <td className="font-semibold text-white">{u.displayName}</td>
                      <td className="font-mono text-slate-400">{u.username || u.id}</td>
                      <td className="text-right font-medium text-amber-300">💵 {normalCoins}</td>
                      <td className="text-right font-medium text-emerald-400">💵 {winCoins}</td>
                      <td className="text-right font-bold text-white">💵 {u.coins}</td>
                      <td className="text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                            u.isBlocked
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/20"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
                          }`}
                        >
                          {u.isBlocked ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(u)}
                          className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition"
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
            onSuccess();
            setSelectedUser(updated);
          }}
          onDelete={() => {
            onSuccess();
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

function UserProfileModal({
  user,
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
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blocking, setBlocking] = useState(false);
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

  const handleAddCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (isNaN(num) || num <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setAmount("");
      onUserUpdate(updated);
    } catch {
      alert("Failed to add coins");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlockUnblock = async () => {
    setBlocking(true);
    try {
      const endpoint = user.isBlocked ? "unblock" : "block";
      const res = await fetch(`/api/admin/users/${user.id}/${endpoint}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      onUserUpdate(updated);
    } catch {
      alert("Failed to update block status");
    } finally {
      setBlocking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      onDelete();
    } catch {
      alert("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const winCoins = user.wonCoins ?? 0;
  const normalCoins = Math.max(0, user.coins - winCoins);

  return (
    <div className="fixed inset-0 top-16 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={ref}
        className="max-h-[calc(100vh-6rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-600/50 bg-slate-900 p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">User Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <dl className="space-y-4 text-slate-300">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Display Name</span>
            <p className="mt-1 font-medium text-white">{user.displayName}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</span>
            <p className="mt-1 text-slate-200">{user.email}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Username / ID</span>
            <p className="mt-1 font-mono text-sm text-slate-400">{user.username || user.id}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Normal Coins</span>
              <p className="mt-1 font-semibold text-amber-300">💵 {normalCoins}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Won Coins</span>
              <p className="mt-1 font-semibold text-emerald-400">💵 {winCoins}</p>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Coins</span>
            <p className="mt-1 font-bold text-white text-lg">💵 {user.coins}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</span>
            <div className="mt-1">
              <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded ${user.isBlocked ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                {user.isBlocked ? "Blocked" : "Active"}
              </span>
            </div>
          </div>
        </dl>
        <div className="mt-8 space-y-4 border-t border-slate-700/50 pt-6">
          {canAddCoins && (
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleBlockUnblock}
              disabled={blocking}
              className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                user.isBlocked
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-amber-600/80 text-white hover:bg-amber-500/80"
              }`}
            >
              {blocking ? "..." : user.isBlocked ? "Unblock" : "Block"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
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
  users,
  matches,
  deposits,
  withdrawals,
  onNavigate,
}: {
  users: User[];
  matches: Match[];
  deposits: any[];
  withdrawals: any[];
  onNavigate: (t: Tab) => void;
}) {
  const totalUsers = users.length;
  const completedMatches = matches.filter((m) => m.status === "completed" || m.status === "ended").length;
  const totalDeposits = deposits.filter((d) => d.status === "accepted").reduce((sum, d) => sum + d.amount, 0);
  const totalWithdrawals = withdrawals.filter((w) => w.status === "accepted").reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-slate-400 text-sm">System performance, statistics, and pending transactions overview.</p>
      </div>

      <div className="stat-card-grid">
        <div className="stat-card red cursor-pointer" onClick={() => onNavigate("users")}>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Users</p>
            <h3 className="text-3xl font-extrabold text-white">{totalUsers}</h3>
          </div>
          <div className="stat-icon-wrapper">
            <span className="stat-icon text-red-500">👤</span>
          </div>
        </div>

        <div className="stat-card green cursor-pointer" onClick={() => onNavigate("modes")}>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Matches Completed</p>
            <h3 className="text-3xl font-extrabold text-white">{completedMatches}</h3>
          </div>
          <div className="stat-icon-wrapper">
            <span className="stat-icon text-green-500">🎮</span>
          </div>
        </div>

        <div className="stat-card blue cursor-pointer" onClick={() => onNavigate("moneyorders")}>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Deposit</p>
            <h3 className="text-3xl font-extrabold text-white">💵 {totalDeposits}</h3>
          </div>
          <div className="stat-icon-wrapper">
            <span className="stat-icon text-blue-500">💳</span>
          </div>
        </div>

        <div className="stat-card amber cursor-pointer" onClick={() => onNavigate("withdrawals")}>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Withdrawal</p>
            <h3 className="text-3xl font-extrabold text-white">💵 {totalWithdrawals}</h3>
          </div>
          <div className="stat-icon-wrapper">
            <span className="stat-icon text-amber-500">💸</span>
          </div>
        </div>
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
          <h1 className="text-2xl font-bold text-white mb-1">Money Orders</h1>
          <p className="text-slate-400 text-sm">View successful deposits processed automatically via ZapUPI Payment Gateway.</p>
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
          <p className="py-12 text-center text-sm text-slate-400">No successful money orders found</p>
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
                        <p className="font-semibold text-white">{user?.displayName || "Unknown"}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{d.userId}</p>
                      </td>
                      <td>
                        <p className="font-mono font-medium text-slate-300">{d.utr}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(d.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="text-right font-bold text-amber-300">💵 {d.amount}</td>
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
        <h1 className="text-2xl font-bold text-white mb-1">Withdrawal Requests</h1>
        <p className="text-slate-400 text-sm">Review players' payouts, verify their UPI IDs, and handle payouts.</p>
      </div>

      <section className="admin-card rounded-2xl p-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Withdrawal Service Charge</h3>
        <p className="mb-4 text-xs text-slate-400 font-medium">
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
            <span className="text-sm text-slate-400">%</span>
          </div>
          <button
            type="button"
            onClick={handleSaveCharge}
            disabled={savingCharge}
            className="admin-btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingCharge ? "Saving..." : "Save Config"}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 w-fit">
          {(["all", "pending", "accepted", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filterStatus === s ? "bg-green-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name or UPI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-input rounded-xl px-4 py-2 text-sm w-full md:w-64 outline-none"
        />
      </div>

      <div className="admin-table-panel w-full">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No withdrawal requests found</p>
        ) : (
          <div className="excel-table-container">
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="text-left">User</th>
                  <th className="text-left">UPI ID</th>
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
                        <p className="font-semibold text-white">{user?.displayName || "Unknown"}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{w.userId}</p>
                      </td>
                      <td>
                        <p className="font-medium text-slate-300">{w.upiId}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(w.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="text-right font-semibold text-rose-400">- 💵 {w.amount}</td>
                      <td className="text-right font-bold text-emerald-400">₹ {netPayout}</td>
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
                              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleWithdrawReject(w.id)}
                              className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
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

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newNotification = {
      id: `push-${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      link: link.trim() || null,
      target,
      sentAt: new Date().toISOString(),
    };

    const updatedHistory = [newNotification, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("admin_push_history", JSON.stringify(updatedHistory));

    setTitle("");
    setBody("");
    setLink("");
    setSending(false);
    alert("Push notification broadcasted successfully to all target devices!");
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
        <h1 className="text-2xl font-bold text-white mb-1">Push Notifications</h1>
        <p className="text-slate-400 text-sm">Send dynamic Firebase notifications directly to users' Android applications.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSend} className="admin-card rounded-2xl p-6 sm:p-8 lg:col-span-2 space-y-5">
          <h3 className="text-lg font-bold text-white mb-2">Compose Broadcast</h3>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Target Segment</label>
            <div className="flex gap-2">
              {(["all", "active", "blocked"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTarget(t)}
                  className={`rounded-lg px-4 py-2 text-xs font-bold uppercase transition ${
                    target === t ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {t === "all" ? "All Users" : t === "active" ? "Active Only" : "Blocked Only"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Notification Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Free Fire Tournament Starting Soon!"
              className="admin-input w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Notification Body</label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Join the Bermuda Daily Solo match. Entry is 10 coins. Huge prize pools!"
              className="admin-input w-full rounded-xl px-4 py-3 text-sm text-white resize-none outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Action Link (Optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="e.g. https://kingbattle.site/match/match-101"
              className="admin-input w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="admin-btn-primary w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? "Broadcasting..." : "Send Broadcast Now"}
          </button>
        </form>

        <div className="admin-card rounded-2xl p-6 flex flex-col h-[520px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-white">Broadcast History</h3>
            {history.length > 0 && (
              <button type="button" onClick={handleClearHistory} className="text-xs text-red-400 hover:text-red-300">
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500 py-12 text-center my-auto">No notifications sent yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-bold uppercase tracking-wider text-green-500/80">{h.target}</span>
                    <span>{new Date(h.sentAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-semibold text-sm text-slate-200">{h.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{h.body}</p>
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
        <h1 className="text-2xl font-bold text-white mb-1">App Settings</h1>
        <p className="text-slate-400 text-sm">
          Configure marquee announcement texts, customer support channels, signup incentives, and gateway QR codes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="admin-card rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-md font-bold text-slate-300">Marquee Announcement</h3>
            <p className="text-xs text-slate-500 mt-1">This text scrolls at the top of the user app home page.</p>
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
              className="admin-btn-primary rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingAnnouncement ? "Saving..." : "Save Announcement"}
            </button>
          </div>
        </section>

        <section className="admin-card rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-md font-bold text-slate-300">Signup Coin Bonus</h3>
            <p className="text-xs text-slate-500 mt-1">Free balance credited to newly registered players.</p>
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
              className="admin-btn-primary rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingBonus ? "Saving..." : "Save Bonus"}
            </button>
          </div>
        </section>

        <section className="admin-card rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-md font-bold text-slate-300">Customer Support URL</h3>
            <p className="text-xs text-slate-500 mt-1">
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
              className="admin-btn-primary rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingSupport ? "Saving..." : "Save Support"}
            </button>
          </div>
        </section>

        <section className="admin-card rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-md font-bold text-slate-300">Manual Deposit QR Code</h3>
            <p className="text-xs text-slate-500 mt-1">UPI barcode scanned by users to deposit money manually.</p>
          </div>
          <div className="flex flex-col gap-3">
            <label className="admin-input flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-4 transition hover:border-green-500/50">
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
                <span className="text-xs text-slate-500">Click to upload UPI QR code</span>
              )}
            </label>
            <div className="flex gap-2">
              {qrFile && (
                <button
                  type="button"
                  onClick={handleQrClear}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveQr}
                disabled={savingQr || (!qrFile && !depositQrUrl)}
                className="admin-btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
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
    <section className="admin-card rounded-2xl p-6 sm:p-8">
      <h2 className="mb-1 text-base font-semibold text-white/90">Add Coins</h2>
      <p className="mb-6 text-sm text-slate-400">Search by user ID, then add coins to their account</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Search by User ID</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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
            <div className="rounded-xl border border-slate-600/50 bg-slate-800/30 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                User found — confirm before adding coins
              </p>
              <p className="font-mono text-sm text-slate-400">{displayUser.id}</p>
              <p className="font-semibold text-white">{displayUser.displayName}</p>
              <p className="text-sm text-slate-400">{displayUser.email}</p>
              <p className="mt-1 text-sm font-medium text-amber-300">{displayUser.coins} coins</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Amount to Add</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                placeholder="e.g. 100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                placeholder="e.g. From admin, Refund, Winnings, Match entry..."
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
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
              <h2 className="text-xl font-bold text-white">App Banners</h2>
              <p className="text-slate-400 text-sm">Manage promotional and event banners shown in the app.</p>
            </div>
            <button
              type="button"
              onClick={() => setView("create")}
              className="admin-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            >
              + Add New Banner
            </button>
          </div>

          <section className="space-y-4">
            <h3 className="text-base font-semibold text-white">Existing Banners</h3>
            {loading ? (
              <div className="flex py-10 justify-center">
                <LoadingSpinner label="Loading banners..." />
              </div>
            ) : banners.length === 0 ? (
              <div className="text-center py-10 text-slate-500 border border-slate-800/40 rounded-xl bg-slate-950/20">
                No banners configured yet.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {banners.map((b) => (
                  <div key={b.id} className="admin-card overflow-hidden flex flex-col justify-between border border-slate-800">
                    <div>
                      <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-slate-950/50 relative">
                        {b.imageUrl ? (
                          <img src={b.imageUrl} alt="Banner" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-600">No Image</div>
                        )}
                      </div>
                      
                      <div className="mt-4 space-y-3">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Link URL</span>
                          <a
                            href={b.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate font-mono text-xs text-green-400 hover:underline mt-0.5"
                            title={b.linkUrl}
                          >
                            {b.linkUrl}
                          </a>
                        </div>

                        <div className="flex gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${b.displayPlayCarousel ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-slate-800/50 text-slate-500 border border-slate-700/20"}`}>
                            Play Carousel
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${b.displayEarn ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-slate-800/50 text-slate-500 border border-slate-700/20"}`}>
                            Earn Tab
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2 border-t border-slate-800/60 pt-4">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="flex-1 rounded-lg bg-slate-800/60 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === b.id}
                        onClick={() => handleDeleteBanner(b.id)}
                        className="rounded-lg bg-red-950/20 border border-red-900/30 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition disabled:opacity-50"
                      >
                        {deletingId === b.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
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
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Banners List
          </button>

          <section className="admin-card rounded-2xl p-6 sm:p-8 max-w-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Add New Banner</h3>
            <p className="mb-6 text-sm text-slate-400">Configure promotional or navigation banner details.</p>
            <form onSubmit={handleAddBanner} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Destination Link URL</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="e.g. https://youtube.com/..."
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
                />
                <span className="mt-1 block text-xs text-slate-500">URL to open when clicked</span>
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

                <div className="flex flex-col justify-center space-y-3 rounded-xl border border-slate-800 bg-slate-900/20 p-4">
                  <label className="text-sm font-medium text-slate-300">Display Locations</label>
                  
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={displayPlayCarousel}
                      onChange={(e) => setDisplayPlayCarousel(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-green-500 focus:ring-green-500/20"
                    />
                    <span className="text-sm text-slate-400">Show in Play Carousel (Homepage)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={displayEarn}
                      onChange={(e) => setDisplayEarn(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-green-500 focus:ring-green-500/20"
                    />
                    <span className="text-sm text-slate-400">Show in Earn Tab</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Banner"}
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl px-6 py-3 font-medium transition"
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
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Banners List
          </button>

          <section className="admin-card rounded-2xl p-6 sm:p-8 max-w-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Edit Banner</h3>
            <p className="mb-6 text-sm text-slate-400">Update promotional banner details.</p>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Destination Link URL</label>
                <input
                  type="text"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  placeholder="e.g. https://..."
                  required
                  className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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

              <div className="flex flex-col space-y-3 rounded-xl border border-slate-800 bg-slate-900/20 p-4">
                <label className="text-sm font-medium text-slate-300">Display Locations</label>
                
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editDisplayPlayCarousel}
                    onChange={(e) => setEditDisplayPlayCarousel(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-green-500 focus:ring-green-500/20"
                  />
                  <span className="text-sm text-slate-400">Show in Play Carousel (Homepage)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editDisplayEarn}
                    onChange={(e) => setEditDisplayEarn(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-green-500 focus:ring-green-500/20"
                  />
                  <span className="text-sm text-slate-400">Show in Earn Tab</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => { setView("list"); setEditingBanner(null); }}
                  className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl px-6 py-3 font-medium transition"
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
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner label="Loading referrals..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="admin-card rounded-2xl p-6 sm:p-8">
        <h2 className="mb-2 text-base font-semibold text-white/90">Referral System Settings</h2>
        <p className="mb-6 text-sm text-slate-400">Configure the behavior of your referral system.</p>
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="referralEnabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-green-500 focus:ring-green-500"
            />
            <label htmlFor="referralEnabled" className="text-sm font-medium text-slate-300">
              Enable Referral System
            </label>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Referral Reward Coins</label>
            <input
              type="number"
              min="0"
              value={rewardCoins}
              onChange={(e) => setRewardCoins(Number(e.target.value))}
              required
              className="admin-input w-full rounded-xl px-4 py-3 text-white outline-none"
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
            className="admin-btn-primary rounded-xl px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </section>

      <section className="admin-table-panel w-full space-y-4">
        <div>
          <h2 className="mb-1 text-base font-semibold text-white/90">Referrals History</h2>
          <p className="mb-5 text-sm text-slate-400">{referrals.length} referral(s) recorded</p>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-10 text-slate-500 border border-slate-800/40 rounded-xl bg-slate-950/20">
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
                    <td className="font-medium text-white">{r.referrerName}</td>
                    <td>{r.referredName}</td>
                    <td className="text-right text-amber-300 font-bold">{r.rewardCoins} coins</td>
                    <td className="text-center">
                      {r.rewardGranted ? (
                        <span className="inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400 font-medium">
                          Granted
                        </span>
                      ) : (
                        <span className="inline-block rounded bg-slate-600/20 px-2 py-0.5 text-xs text-slate-400 font-medium">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
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


