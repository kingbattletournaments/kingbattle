"use client";

type BoneProps = {
  className?: string;
};

/** Shimmer placeholder block — matches admin light theme. */
export function SkeletonBone({ className = "" }: BoneProps) {
  return <div className={`admin-skeleton ${className}`.trim()} aria-hidden />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBone className="h-8 w-40" />
          <SkeletonBone className="h-4 w-72 max-w-full" />
        </div>
        <SkeletonBone className="h-10 w-32 rounded-xl" />
      </div>

      {[0, 1, 2].map((section) => (
        <section key={section}>
          <SkeletonBone className="mb-4 h-3 w-28" />
          <div className="stat-card-grid">
            {Array.from({ length: section === 0 ? 4 : 3 }).map((_, i) => (
              <div key={i} className="stat-card">
                <div className="space-y-3 flex-1">
                  <SkeletonBone className="h-3 w-24" />
                  <SkeletonBone className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="dashboard-quick-grid">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="dashboard-quick-panel space-y-3">
            <SkeletonBone className="h-5 w-36" />
            {Array.from({ length: 4 }).map((__, j) => (
              <SkeletonBone key={j} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

export function AdminMatchCardSkeleton() {
  return (
    <div className="admin-content-card overflow-hidden rounded-2xl border border-zinc-200">
      <SkeletonBone className="aspect-[16/7] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <SkeletonBone className="h-5 w-3/4 max-w-xs" />
        <SkeletonBone className="h-3 w-1/2 max-w-[200px]" />
        <div className="flex gap-2">
          <SkeletonBone className="h-6 w-16 rounded-full" />
          <SkeletonBone className="h-6 w-20 rounded-full" />
        </div>
        <SkeletonBone className="h-2 w-full rounded-full" />
        <div className="flex gap-2 pt-1">
          <SkeletonBone className="h-9 flex-1 rounded-lg" />
          <SkeletonBone className="h-9 flex-1 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function AdminMatchListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SkeletonBone className="h-9 w-9 rounded-xl" />
        <div className="space-y-2 flex-1">
          <SkeletonBone className="h-7 w-56 max-w-full" />
          <SkeletonBone className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBone key={i} className="h-9 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <AdminMatchCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function AdminModeListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <SkeletonBone className="h-8 w-48" />
        <SkeletonBone className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="admin-list-item rounded-xl p-4 space-y-3">
            <SkeletonBone className="aspect-video w-full rounded-lg" />
            <SkeletonBone className="h-5 w-2/3" />
            <SkeletonBone className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminGamesGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonBone className="h-8 w-32" />
        <SkeletonBone className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="admin-list-item rounded-xl p-5 flex items-center gap-4">
            <SkeletonBone className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBone className="h-5 w-32" />
              <SkeletonBone className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="admin-table-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBone className="h-8 w-40" />
        <SkeletonBone className="h-10 w-64 rounded-xl" />
      </div>
      <div className="admin-content-card overflow-hidden rounded-xl border border-zinc-200">
        <div className="flex gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <SkeletonBone key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b border-zinc-100 px-4 py-3 last:border-0">
            {Array.from({ length: cols }).map((__, c) => (
              <SkeletonBone key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminBannerGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBone className="h-8 w-36" />
          <SkeletonBone className="h-4 w-64" />
        </div>
        <SkeletonBone className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="admin-content-card overflow-hidden rounded-2xl">
            <SkeletonBone className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <SkeletonBone className="h-3 w-24" />
              <SkeletonBone className="h-4 w-full" />
              <div className="flex gap-2">
                <SkeletonBone className="h-9 flex-1 rounded-lg" />
                <SkeletonBone className="h-9 w-20 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminFormPanelSkeleton() {
  return (
    <div className="space-y-8">
      <div className="admin-panel space-y-4">
        <SkeletonBone className="h-6 w-48" />
        <SkeletonBone className="h-4 w-full max-w-md" />
        <SkeletonBone className="h-10 w-full max-w-sm rounded-xl" />
        <SkeletonBone className="h-10 w-full max-w-sm rounded-xl" />
        <SkeletonBone className="h-32 w-full max-w-lg rounded-xl" />
        <SkeletonBone className="h-10 w-28 rounded-xl" />
      </div>
      <div className="admin-panel">
        <SkeletonBone className="mb-4 h-6 w-40" />
        <AdminTableSkeleton rows={5} cols={4} />
      </div>
    </div>
  );
}

export function AdminMatchDetailSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBone className="h-5 w-32" />
      <div className="admin-panel space-y-4">
        <div className="flex flex-wrap gap-2">
          <SkeletonBone className="h-6 w-20 rounded-full" />
          <SkeletonBone className="h-6 w-24 rounded-full" />
        </div>
        <SkeletonBone className="h-8 w-2/3 max-w-md" />
        <SkeletonBone className="h-4 w-48" />
      </div>
      <div className="admin-panel space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <SkeletonBone className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonBone className="h-4 w-40" />
              <SkeletonBone className="h-3 w-28" />
            </div>
            <SkeletonBone className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminGenericPanelSkeleton() {
  return (
    <div className="admin-panel space-y-4">
      <SkeletonBone className="h-8 w-48" />
      <SkeletonBone className="h-4 w-full max-w-lg" />
      <SkeletonBone className="h-64 w-full rounded-xl" />
    </div>
  );
}

type AdminTabSkeletonProps = {
  tab: string;
  selectedGameId?: string | null;
  selectedModeId?: string | null;
};

export function AdminTabSkeleton({ tab, selectedGameId, selectedModeId }: AdminTabSkeletonProps) {
  if (tab === "dashboard") return <DashboardSkeleton />;
  if (tab === "modes") {
    if (selectedModeId) return <AdminMatchListSkeleton count={4} />;
    if (selectedGameId) return <AdminModeListSkeleton count={6} />;
    return <AdminGamesGridSkeleton count={4} />;
  }
  if (tab === "presets") return <AdminTableSkeleton rows={6} cols={4} />;
  if (tab === "moneyorders" || tab === "withdrawals" || tab === "users") {
    return <AdminTableSkeleton rows={10} cols={5} />;
  }
  if (tab === "banners") return <AdminBannerGridSkeleton count={3} />;
  if (tab === "referrals") return <AdminFormPanelSkeleton />;
  if (tab === "admins") return <AdminFormPanelSkeleton />;
  if (tab === "notifications") return <AdminGenericPanelSkeleton />;
  if (tab === "appsettings") return <AdminFormPanelSkeleton />;
  return <AdminGenericPanelSkeleton />;
}
