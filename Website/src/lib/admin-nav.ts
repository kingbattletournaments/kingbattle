/** URL query params for admin panel navigation (survives browser refresh). */

export const ADMIN_MATCH_STATUSES = ["upcoming", "ongoing", "finished"] as const;
export type AdminMatchStatus = (typeof ADMIN_MATCH_STATUSES)[number];

export const ADMIN_MATCH_VIEWS = ["manage", "leaderboard", "registered"] as const;
export type AdminMatchView = (typeof ADMIN_MATCH_VIEWS)[number];

export type AdminNavParams = {
  tab: string;
  game: string | null;
  mode: string | null;
  mstatus: AdminMatchStatus;
  match: string | null;
  mview: AdminMatchView;
};

function parseMatchStatus(raw: string | null): AdminMatchStatus {
  return ADMIN_MATCH_STATUSES.includes(raw as AdminMatchStatus)
    ? (raw as AdminMatchStatus)
    : "upcoming";
}

function parseMatchView(raw: string | null): AdminMatchView {
  return ADMIN_MATCH_VIEWS.includes(raw as AdminMatchView)
    ? (raw as AdminMatchView)
    : "registered";
}

export function readAdminNavParams(searchParams: URLSearchParams): AdminNavParams {
  return {
    tab: searchParams.get("tab") ?? "dashboard",
    game: searchParams.get("game"),
    mode: searchParams.get("mode"),
    mstatus: parseMatchStatus(searchParams.get("mstatus")),
    match: searchParams.get("match"),
    mview: parseMatchView(searchParams.get("mview")),
  };
}

type AdminNavPatch = Partial<{
  tab: string | null;
  game: string | null;
  mode: string | null;
  mstatus: AdminMatchStatus | null;
  match: string | null;
  mview: AdminMatchView | null;
}>;

const PARAM_KEYS: Record<keyof AdminNavPatch, string> = {
  tab: "tab",
  game: "game",
  mode: "mode",
  mstatus: "mstatus",
  match: "match",
  mview: "mview",
};

/** Omit default values to keep URLs short. */
function shouldOmitParam(key: string, value: string): boolean {
  if (key === "tab" && value === "dashboard") return true;
  if (key === "mstatus" && value === "upcoming") return true;
  if (key === "mview" && value === "registered") return true;
  return false;
}

export function buildAdminNavQuery(
  current: URLSearchParams,
  patch: AdminNavPatch,
): string {
  const next = new URLSearchParams(current.toString());

  for (const [field, value] of Object.entries(patch) as [keyof AdminNavPatch, string | null][]) {
    const key = PARAM_KEYS[field];
    if (value == null || value === "") {
      next.delete(key);
      continue;
    }
    if (shouldOmitParam(key, value)) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  return next.toString();
}
