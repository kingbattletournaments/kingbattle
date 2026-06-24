import { getStore } from "@/lib/store";
import type { DbMatch } from "@/lib/db";

export type LandingLeaderboardEntry = {
  id: string;
  displayName: string;
  wins: number;
};

export type LandingTournamentSection = {
  modeId: string;
  modeName: string;
  gameName: string;
  modeImage: string | null;
  matches: DbMatch[];
};

export type LandingBanner = {
  id: string;
  imageUrl: string;
  linkUrl: string;
};

export type LandingPageData = {
  tournamentSections: LandingTournamentSection[];
  leaderboard: LandingLeaderboardEntry[];
  banners: LandingBanner[];
};

function isUpcomingMatch(status: string): boolean {
  const s = status.toLowerCase();
  return s === "upcoming" || s === "scheduled" || s === "pending";
}

export async function getLandingPageData(): Promise<LandingPageData> {
  const store = getStore();

  const [games, modes, allUsers, bannersRaw] = await Promise.all([
    store.games(),
    store.gameModes(),
    store.users(),
    store.getBanners().catch(() => []),
  ]);

  const gameNameById = new Map(games.map((g) => [g.id, g.name]));

  const tournamentSections: LandingTournamentSection[] = [];

  for (const mode of modes) {
    const matches = await store.matches(mode.id);
    const upcoming = matches
      .filter((m) => isUpcomingMatch(m.status))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 3);

    if (upcoming.length === 0) continue;

    tournamentSections.push({
      modeId: mode.id,
      modeName: mode.name,
      gameName: gameNameById.get(mode.gameId) ?? "Free Fire",
      modeImage: mode.imageUrl ?? null,
      matches: upcoming,
    });
  }

  const leaderboard = [...allUsers]
    .sort((a, b) => {
      const scoreA = a.lifetimeEarnedPoints ?? a.coins ?? 0;
      const scoreB = b.lifetimeEarnedPoints ?? b.coins ?? 0;
      return scoreB - scoreA;
    })
    .slice(0, 10)
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      wins: u.lifetimeEarnedPoints ?? u.coins ?? 0,
    }));

  const banners = (bannersRaw ?? [])
    .filter((b) => b.displayPlayCarousel && b.imageUrl)
    .map((b) => ({
      id: b.id,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl ?? "",
    }));

  return { tournamentSections, leaderboard, banners };
}
