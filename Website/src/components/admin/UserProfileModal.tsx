"use client";

import { useEffect, useState } from "react";
import { CoinAmount } from "@/components/ui/CoinIcon";
import { normalizeAdminUser, type AdminUserRecord } from "@/lib/admin-user";
import type { UserTransactionFeedItem } from "@/lib/user-transaction-feed";

export type AdminUserProfile = AdminUserRecord;

type ProfileTab = "overview" | "transactions" | "actions";

function formatTxDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50/80 p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-amber-600" : "text-zinc-900"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

export function UserProfileModal({
  user: initialUser,
  canAddCoins,
  onClose,
  onUserUpdate,
  onDelete,
}: {
  user: AdminUserProfile;
  canAddCoins: boolean;
  onClose: () => void;
  onUserUpdate: (user: AdminUserProfile) => void;
  onDelete: () => void;
}) {
  const toUserRecord = (raw: unknown): AdminUserProfile => normalizeAdminUser(raw);

  const [profile, setProfile] = useState<AdminUserProfile>(() => toUserRecord(initialUser));
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState<"normal" | "won">("normal");
  const [submitting, setSubmitting] = useState(false);

  const [blocking, setBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blockReasonDraft, setBlockReasonDraft] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);

  const [transactions, setTransactions] = useState<UserTransactionFeedItem[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    setProfileError(null);
    setBlockReasonDraft("");
    setShowBlockForm(false);
    setActiveTab("overview");

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
    if (activeTab !== "transactions") return;
    let cancelled = false;
    setLoadingTx(true);
    setTxError(null);
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${profile.id}/transactions`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load transactions");
        const data = (await res.json()) as UserTransactionFeedItem[];
        if (!cancelled) setTransactions(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setTxError("Could not load transactions.");
          setTransactions([]);
        }
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, profile.id]);

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
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, showBlockForm]);

  const isBlocked = profile.isBlocked === true;
  const winCoins = profile.wonCoins ?? 0;
  const normalCoins = Math.max(0, profile.coins - winCoins);

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
        body: JSON.stringify({
          amount: num,
          wallet,
          description: note.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      applyUpdatedUser(await res.json());
      setAmount("");
      setNote("");
      if (activeTab === "transactions") {
        const txRes = await fetch(`/api/admin/users/${profile.id}/transactions`, { cache: "no-store" });
        if (txRes.ok) setTransactions(await txRes.json());
      }
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
      if (!res.ok) throw new Error(await res.text());
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

  const initials = profile.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "actions", label: "Actions" },
  ];

  return (
    <div
      className="fixed inset-0 top-16 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold ring-2 ring-white/20">
                {initials || "?"}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">{profile.displayName}</h2>
                <p className="truncate text-sm text-zinc-300">{profile.email}</p>
                <p className="mt-1 font-mono text-xs text-zinc-400">@{profile.username || profile.id}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isBlocked
                    ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30"
                    : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30"
                }`}
              >
                {isBlocked ? "Blocked" : "Active"}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex border-b border-zinc-200 bg-zinc-50/80 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-zinc-900" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loadingProfile && activeTab === "overview" ? (
            <p className="text-sm text-zinc-500">Loading profile…</p>
          ) : null}
          {profileError ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {profileError}
            </p>
          ) : null}

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Player stats (same as app account tab)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Matches played" value={String(profile.matchesPlayed ?? 0)} />
                  <StatCard label="Total kills" value={String(profile.totalKills ?? 0)} />
                  <StatCard
                    label="Amount won"
                    value={String(profile.lifetimeEarnedPoints ?? 0)}
                    accent
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Wallets</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
                    <p className="text-xs font-medium text-amber-800/80">Normal coins</p>
                    <p className="mt-2 text-lg font-bold text-amber-900">
                      <CoinAmount amount={normalCoins} size={16} />
                    </p>
                    <p className="mt-1 text-[11px] text-amber-800/70">Deposit / entry wallet</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4">
                    <p className="text-xs font-medium text-emerald-800/80">Won coins</p>
                    <p className="mt-2 text-lg font-bold text-emerald-900">
                      <CoinAmount amount={winCoins} size={16} />
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800/70">Withdrawable winnings</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-medium text-zinc-600">Total balance</p>
                    <p className="mt-2 text-lg font-bold text-zinc-900">
                      <CoinAmount amount={profile.coins} size={16} />
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">Normal + won</p>
                  </div>
                </div>
              </div>

              {isBlocked && profile.blockReason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Ban reason</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-rose-900">{profile.blockReason}</p>
                </div>
              ) : null}

              {canAddCoins && !isBlocked && (
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-zinc-900">Add balance</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Choose wallet type and enter a note — the player will see this note in their transaction history.
                  </p>
                  <form onSubmit={handleAddCoins} className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-zinc-600">Amount</label>
                        <input
                          type="number"
                          min="1"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="e.g. 500"
                          className="admin-input w-full rounded-lg px-3 py-2.5 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-zinc-600">Wallet</label>
                        <div className="flex gap-2">
                          {(
                            [
                              ["normal", "Normal coins"],
                              ["won", "Won coins"],
                            ] as const
                          ).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setWallet(value)}
                              className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                                wallet === value
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                        Transaction note
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder='e.g. Refund for hacker in match #0042'
                        className="admin-input w-full resize-none rounded-lg px-3 py-2.5 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !amount}
                      className="admin-btn-primary rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                      {submitting ? "Adding…" : `Add to ${wallet === "won" ? "won" : "normal"} wallet`}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">
                Same transaction history the player sees in the app wallet / account area.
              </p>
              {loadingTx ? (
                <p className="py-8 text-center text-sm text-zinc-500">Loading transactions…</p>
              ) : txError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {txError}
                </p>
              ) : transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">No transactions yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900">{tx.note}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{formatTxDate(tx.createdAt)}</p>
                        {tx.status ? (
                          <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                            {tx.status}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          tx.type === "credit" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.type === "credit" ? "+" : "−"}
                        {Math.abs(tx.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === "actions" && (
            <div className="space-y-4">
              {!isBlocked && showBlockForm ? (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                  <label htmlFor="block-reason" className="mb-2 block text-sm font-semibold text-zinc-900">
                    Block reason (required)
                  </label>
                  <textarea
                    id="block-reason"
                    value={blockReasonDraft}
                    onChange={(e) => setBlockReasonDraft(e.target.value)}
                    placeholder="e.g. Using hacks in tournament..."
                    rows={4}
                    disabled={blocking}
                    autoFocus
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleBlockUser}
                      disabled={blocking || !blockReasonDraft.trim()}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {blocking ? "Blocking…" : "Confirm block"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBlockForm(false);
                        setBlockReasonDraft("");
                      }}
                      disabled={blocking}
                      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!isBlocked ? (
                  !showBlockForm && (
                    <button
                      type="button"
                      onClick={() => setShowBlockForm(true)}
                      disabled={loadingProfile || blocking}
                      className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      Block user
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleUnblock}
                    disabled={loadingProfile || blocking}
                    className="admin-btn-primary rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {blocking ? "Unblocking…" : "Unblock user"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
