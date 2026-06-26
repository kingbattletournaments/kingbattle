/**
 * In-memory admin store for demo.
 * Replace with Supabase calls for production.
 */

import bcrypt from "bcryptjs";
import {
  emptyTabAccess,
  legacyPermissionsFromTabAccess,
  masterTabAccess,
  normalizeTabAccess,
  type AdminTabAccess,
} from "./admin-tabs";
import type { DashboardStats } from "./dashboard-stats";

export type Game = { id: string; name: string; imageUrl: string | null };
export type GameMode = { id: string; gameId: string; name: string; imageUrl: string | null };
export type MatchType = "solo" | "duo" | "squad";

export type RankReward = { fromRank: number; toRank: number; coins: number };

export type PrizePool = {
  coinsPerKill: number;
  totalPrizePool?: number; // Total prize pool for the whole match (displayed with coins per kill)
  rankRewards: RankReward[];
};

export type Match = {
  id: string;
  gameModeId: string;
  title: string;
  entryFee: number;
  roomCode: string | null;
  roomPassword: string | null;
  status: "upcoming" | "ongoing" | "ended" | "completed" | "cancelled";
  maxParticipants: number;
  scheduledAt: string;
  registrationLocked: boolean;
  matchType: MatchType;
  prizePool: PrizePool;
  map: string;
  image?: string;
};

export type MatchPreset = {
  id: string;
  gameModeId: string;
  name: string;
  title: string;
  entryFee: number;
  maxParticipants: number;
  matchType: MatchType;
  map: string;
  prizePool: PrizePool;
  image?: string | null;
  createdAt?: string;
};

export type TeamMember = { inGameName: string; inGameUid: string; kills?: number };
export type MatchParticipant = {
  id: string;
  matchId: string;
  userId: string;
  teamMembers: TeamMember[];
  joinedAt: string;
  rank?: number; // Set when player dies; used for live leaderboard order
};
export type User = {
  id: string;
  email: string;
  displayName: string;
  coins: number;
  wonCoins: number;
  isBlocked?: boolean;
  lifetimeEarnedPoints?: number;
  matchesPlayed?: number;
  totalKills?: number;
  avatarUrl?: string;
  createdAt?: string;
  username?: string;
  fcmToken?: string;
};

export type AppBanner = {
  id: string;
  imageUrl: string;
  linkUrl: string;
  displayPlayCarousel: boolean;
  displayEarn: boolean;
  createdAt?: string;
};

export type CoinTransaction = {
  id: string;
  userId: string;
  amount: number;
  type: "admin_add" | "match_entry" | "refund" | "deposit" | "deposit_failed" | "withdraw" | "withdraw_failed" | "signup_bonus" | "match_winning";
  referenceId?: string;
  description?: string;
  createdAt: string;
};

export type DepositRequest = {
  id: string;
  userId: string;
  amount: number;
  utr: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  status: "pending" | "accepted" | "rejected";
  rejectNote?: string;
  chargePercent?: number; // charge % at time of request (0 = no charge)
  createdAt: string;
};

export type AdminPermission = {
  id: string;
  adminname: string;
  passwordHash: string;
  isMasterAdmin: boolean;
  usersAccess: boolean;
  coinsAccess: boolean;
  gamesAccessType: "all" | "specific";
  allowedGameIds: string[];
  tabAccess: AdminTabAccess;
  createdAt: string;
};

// Persist admin data across Next.js hot reloads in development (for testing server)
const globalForAdmin = globalThis as unknown as {
  adminPermissions?: AdminPermission[];
  adminIdCounter?: number;
  withdrawalChargePercent?: number;
  signupBonus?: number;
  customerSupportUrl?: string | null;
  adminStoreUsers?: User[];
  adminStoreCoinTransactions?: CoinTransaction[];
  adminStoreDepositRequests?: DepositRequest[];
  adminStoreWithdrawalRequests?: WithdrawalRequest[];
  adminStoreMatchParticipants?: MatchParticipant[];
  adminStoreMatchParticipantIdCounter?: number;
  adminStoreTransactionIdCounter?: number;
  adminStoreDepositRequestIdCounter?: number;
  adminStoreWithdrawalRequestIdCounter?: number;
  announcementText?: string | null;
  bannerImageUrl?: string | null;
  // new additions to persist games, modes, matches, orders, and counters
  adminStoreGames?: Game[];
  adminStoreGameModes?: GameMode[];
  adminStoreMatches?: Match[];
  adminStoreMatchPresets?: MatchPreset[];
  adminStoreMatchParticipantOrder?: Record<string, string[]>;
  gameIdCounter?: number;
  modeIdCounter?: number;
  matchIdCounter?: number;
  matchPresetIdCounter?: number;
  adminStoreBanners?: AppBanner[];
  bannerIdCounter?: number;
  referralSystemEnabled?: boolean;
  referralRewardCoins?: number;
  referralBannerUrl?: string | null;
  adminStoreReferrals?: Referral[];
  adminStoreReferralsIdCounter?: number;
};

let gameIdCounter = globalForAdmin.gameIdCounter ?? 100;
let modeIdCounter = globalForAdmin.modeIdCounter ?? 100;
let matchIdCounter = globalForAdmin.matchIdCounter ?? 100;
let matchPresetIdCounter = globalForAdmin.matchPresetIdCounter ?? 100;

let referralSystemEnabled = globalForAdmin.referralSystemEnabled ?? false;
let referralRewardCoins = globalForAdmin.referralRewardCoins ?? 10;
let referralBannerUrl = globalForAdmin.referralBannerUrl ?? "";

export interface Referral {
  id: string;
  referrerId: string;
  referredId: string;
  rewardCoins: number;
  rewardGranted: boolean;
  createdAt: string;
}

const referrals: Referral[] = globalForAdmin.adminStoreReferrals ?? (globalForAdmin.adminStoreReferrals = []);
let referralsIdCounter = globalForAdmin.adminStoreReferralsIdCounter ?? 1;

function nextReferralId() {
  const v = referralsIdCounter;
  referralsIdCounter = v + 1;
  globalForAdmin.adminStoreReferralsIdCounter = referralsIdCounter;
  return `ref-${v}`;
}

const appBanners: AppBanner[] = globalForAdmin.adminStoreBanners ?? (globalForAdmin.adminStoreBanners = []);
let bannerIdCounter = globalForAdmin.bannerIdCounter ?? 1;

function nextBannerId() {
  const v = bannerIdCounter;
  bannerIdCounter = v + 1;
  globalForAdmin.bannerIdCounter = bannerIdCounter;
  return `banner-${v}`;
}

const games: Game[] = globalForAdmin.adminStoreGames ?? (globalForAdmin.adminStoreGames = []);
const gameModes: GameMode[] = globalForAdmin.adminStoreGameModes ?? (globalForAdmin.adminStoreGameModes = []);
const matches: Match[] = globalForAdmin.adminStoreMatches ?? (globalForAdmin.adminStoreMatches = []);
const matchPresets: MatchPreset[] = globalForAdmin.adminStoreMatchPresets ?? (globalForAdmin.adminStoreMatchPresets = []);
const matchParticipantOrder: Record<string, string[]> = globalForAdmin.adminStoreMatchParticipantOrder ?? (globalForAdmin.adminStoreMatchParticipantOrder = {});

const defaultPrizePool: PrizePool = {
  coinsPerKill: 5,
  totalPrizePool: 0,
  rankRewards: [
    { fromRank: 1, toRank: 1, coins: 0 },
    { fromRank: 2, toRank: 2, coins: 0 },
    { fromRank: 3, toRank: 3, coins: 0 },
    { fromRank: 6, toRank: 10, coins: 0 },
  ],
};

const matchParticipants: MatchParticipant[] = globalForAdmin.adminStoreMatchParticipants ?? (globalForAdmin.adminStoreMatchParticipants = []);
let matchParticipantIdCounter = globalForAdmin.adminStoreMatchParticipantIdCounter ?? 1;

function generateUniqueUserId(): string {
  const existing = new Set(users.map((u) => u.id));
  let id: string;
  do {
    id = String(Math.floor(10000 + Math.random() * 90000));
  } while (existing.has(id));
  return id;
}

const users: User[] = globalForAdmin.adminStoreUsers ?? (globalForAdmin.adminStoreUsers = []);
const coinTransactions: CoinTransaction[] = globalForAdmin.adminStoreCoinTransactions ?? (globalForAdmin.adminStoreCoinTransactions = []);
const depositRequests: DepositRequest[] = globalForAdmin.adminStoreDepositRequests ?? (globalForAdmin.adminStoreDepositRequests = []);
const withdrawalRequests: WithdrawalRequest[] = globalForAdmin.adminStoreWithdrawalRequests ?? (globalForAdmin.adminStoreWithdrawalRequests = []);

function nextTxId() {
  const v = (globalForAdmin.adminStoreTransactionIdCounter ?? 1);
  globalForAdmin.adminStoreTransactionIdCounter = v + 1;
  return `tx-${v}`;
}
function nextDrId() {
  const v = (globalForAdmin.adminStoreDepositRequestIdCounter ?? 1);
  globalForAdmin.adminStoreDepositRequestIdCounter = v + 1;
  return `dr-${v}`;
}
function nextWrId() {
  const v = (globalForAdmin.adminStoreWithdrawalRequestIdCounter ?? 1);
  globalForAdmin.adminStoreWithdrawalRequestIdCounter = v + 1;
  return `wr-${v}`;
}

let depositQrUrl: string | null = null;
let customerSupportUrl: string | null = globalForAdmin.customerSupportUrl ?? null;
let announcementText: string | null = globalForAdmin.announcementText ?? null;
let bannerImageUrl: string | null = globalForAdmin.bannerImageUrl ?? "";

const initialAdminPermissions: AdminPermission[] = [
  {
    id: "admin-master",
    adminname: "masteradmin",
    passwordHash: bcrypt.hashSync("master123", 10),
    isMasterAdmin: true,
    usersAccess: true,
    coinsAccess: true,
    gamesAccessType: "all",
    allowedGameIds: [],
    tabAccess: masterTabAccess(),
    createdAt: new Date().toISOString(),
  },
];

const adminPermissions =
  globalForAdmin.adminPermissions ?? (globalForAdmin.adminPermissions = [...initialAdminPermissions]);
let adminIdCounter = globalForAdmin.adminIdCounter ?? 1;
let withdrawalChargePercent = globalForAdmin.withdrawalChargePercent ?? 0;
let signupBonus = globalForAdmin.signupBonus ?? 0;

// Seeding function to populate rich mockup data for testing the Admin panel
function seedMockData() {
  if (users.length === 0) {
    const testUserPasswordHash = bcrypt.hashSync("test123", 10);
    const testUser: User & { passwordHash?: string } = {
      id: "testuser",
      email: "test@user.com",
      displayName: "Test User",
      coins: 100,
      wonCoins: 0,
      isBlocked: false,
      passwordHash: testUserPasswordHash,
      lifetimeEarnedPoints: 0,
      matchesPlayed: 0,
      totalKills: 0,
      username: "testuser",
      createdAt: new Date().toISOString(),
    };
    users.push(testUser);
  }
}
function seedMockDataDisabled() {
  if (appBanners.length === 0) {
    appBanners.push(
      {
        id: "banner-1",
        imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800",
        linkUrl: "https://youtube.com/@kingbattle",
        displayPlayCarousel: true,
        displayEarn: true
      },
      {
        id: "banner-2",
        imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800",
        linkUrl: "https://chat.whatsapp.com/kingbattle",
        displayPlayCarousel: true,
        displayEarn: false
      },
      {
        id: "banner-3",
        imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=800",
        linkUrl: "https://t.me/kingbattle",
        displayPlayCarousel: false,
        displayEarn: true
      }
    );
  }

  if (gameModes.length === 0) {
    gameModes.push(
      { id: "m-solo", gameId: "default-game-free-fire", name: "Solo", imageUrl: null },
      { id: "m-duo", gameId: "default-game-free-fire", name: "Duo", imageUrl: null },
      { id: "m-squad", gameId: "default-game-free-fire", name: "Squad", imageUrl: null }
    );
  }

  if (users.length === 0) {
    const user1PasswordHash = bcrypt.hashSync("password123", 10);
    const user1: User & { passwordHash?: string } = {
      id: "amit",
      email: "amit@example.com",
      displayName: "Amit Sharma",
      coins: 150,
      wonCoins: 50,
      isBlocked: false,
      passwordHash: user1PasswordHash,
      lifetimeEarnedPoints: 50,
      matchesPlayed: 5,
      totalKills: 12,
      username: "amit",
      avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocL_3a8h8k3",
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const user2: User & { passwordHash?: string } = {
      id: "rahul",
      email: "rahul@example.com",
      displayName: "Rahul Verma",
      coins: 25,
      wonCoins: 0,
      isBlocked: true,
      passwordHash: user1PasswordHash,
      lifetimeEarnedPoints: 10,
      matchesPlayed: 2,
      totalKills: 3,
      username: "rahul",
      avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocL_2d9i9x4",
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const user3: User & { passwordHash?: string } = {
      id: "sunita",
      email: "sunita@example.com",
      displayName: "Sunita Patel",
      coins: 500,
      wonCoins: 100,
      isBlocked: false,
      passwordHash: user1PasswordHash,
      lifetimeEarnedPoints: 200,
      matchesPlayed: 15,
      totalKills: 45,
      username: "sunita",
      avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocL_8s2k1w2",
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const user4: User & { passwordHash?: string } = {
      id: "vikram",
      email: "vikram@example.com",
      displayName: "Vikram Singh",
      coins: 0,
      wonCoins: 0,
      isBlocked: false,
      passwordHash: user1PasswordHash,
      lifetimeEarnedPoints: 0,
      matchesPlayed: 0,
      totalKills: 0,
      username: "vikram",
      avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocL_7a3b4c5",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    };
    users.push(user1, user2, user3, user4);

    coinTransactions.push(
      {
        id: "tx-1",
        userId: "amit",
        amount: 100,
        type: "deposit",
        referenceId: "UTR1234567890",
        description: "Deposited via UPI",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "tx-2",
        userId: "sunita",
        amount: 500,
        type: "deposit",
        referenceId: "UTR9998887776",
        description: "Deposited via UPI",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "tx-3",
        userId: "amit",
        amount: -50,
        type: "withdraw",
        referenceId: "amit@upi",
        description: "Withdraw",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }
    );
  }

  if (matches.length === 0) {
    matches.push(
      {
        id: "match-101",
        gameModeId: "m-solo",
        title: "Bermuda Daily Solo Warmup",
        entryFee: 10,
        roomCode: null,
        roomPassword: null,
        status: "upcoming",
        maxParticipants: 50,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // in 2 hours
        registrationLocked: false,
        matchType: "solo",
        prizePool: {
          coinsPerKill: 5,
          totalPrizePool: 250,
          rankRewards: [
            { fromRank: 1, toRank: 1, coins: 100 },
            { fromRank: 2, toRank: 2, coins: 50 },
            { fromRank: 3, toRank: 3, coins: 25 },
          ],
        },
        map: "BERMUDA",
        image: "match_poster_1",
      },
      {
        id: "match-102",
        gameModeId: "m-solo",
        title: "Free Fire Sunday Rush (Solo)",
        entryFee: 0,
        roomCode: "ROOM7778",
        roomPassword: "123",
        status: "ongoing",
        maxParticipants: 100,
        scheduledAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // started 15 mins ago
        registrationLocked: true,
        matchType: "solo",
        prizePool: {
          coinsPerKill: 2,
          totalPrizePool: 100,
          rankRewards: [
            { fromRank: 1, toRank: 1, coins: 50 },
            { fromRank: 2, toRank: 5, coins: 10 },
          ],
        },
        map: "PURGATORY",
        image: "match_poster_2",
      },
      {
        id: "match-103",
        gameModeId: "m-duo",
        title: "Kalahari Duo Showdown",
        entryFee: 20,
        roomCode: "ROOM5521",
        roomPassword: "999",
        status: "completed",
        maxParticipants: 25,
        scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
        registrationLocked: true,
        matchType: "duo",
        prizePool: {
          coinsPerKill: 10,
          totalPrizePool: 500,
          rankRewards: [
            { fromRank: 1, toRank: 1, coins: 200 },
            { fromRank: 2, toRank: 2, coins: 100 },
          ],
        },
        map: "KALAHARI",
        image: "match_poster_3",
      },
      {
        id: "match-104",
        gameModeId: "m-squad",
        title: "Bermuda Squad Tournament",
        entryFee: 40,
        roomCode: null,
        roomPassword: null,
        status: "upcoming",
        maxParticipants: 12,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        registrationLocked: false,
        matchType: "squad",
        prizePool: {
          coinsPerKill: 20,
          totalPrizePool: 1000,
          rankRewards: [
            { fromRank: 1, toRank: 1, coins: 500 },
            { fromRank: 2, toRank: 2, coins: 300 },
          ],
        },
        map: "BERMUDA",
        image: "match_poster_1",
      }
    );

    // Register some participants
    matchParticipants.push(
      {
        id: "mp-1",
        matchId: "match-101",
        userId: "amit",
        teamMembers: [{ inGameName: "AmitFF", inGameUid: "987654321", kills: 0 }],
        joinedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "mp-2",
        matchId: "match-101",
        userId: "sunita",
        teamMembers: [{ inGameName: "SunitaGamer", inGameUid: "123456789", kills: 0 }],
        joinedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: "mp-3",
        matchId: "match-102",
        userId: "amit",
        teamMembers: [{ inGameName: "AmitFF", inGameUid: "987654321", kills: 2 }],
        joinedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        rank: 12,
      },
      {
        id: "mp-4",
        matchId: "match-102",
        userId: "sunita",
        teamMembers: [{ inGameName: "SunitaGamer", inGameUid: "123456789", kills: 5 }],
        joinedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      }
    );
  }

  if (depositRequests.length === 0) {
    depositRequests.push(
      {
        id: "dr-1001",
        userId: "amit",
        amount: 100,
        utr: "UTR1234567890",
        status: "accepted",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "dr-1002",
        userId: "sunita",
        amount: 500,
        utr: "UTR9998887776",
        status: "accepted",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "dr-1003",
        userId: "vikram",
        amount: 50,
        utr: "UTR0000000000",
        status: "rejected",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "dr-1004",
        userId: "amit",
        amount: 75,
        utr: "UTR2223334445",
        status: "pending",
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      }
    );
  }

  if (withdrawalRequests.length === 0) {
    withdrawalRequests.push(
      {
        id: "wr-1001",
        userId: "amit",
        amount: 50,
        upiId: "amit@upi",
        status: "accepted",
        chargePercent: 0,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "wr-1002",
        userId: "sunita",
        amount: 200,
        upiId: "sunita@upi",
        status: "pending",
        chargePercent: 5,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      }
    );
  }
}

// Call seedMockData to populate lists
seedMockData();

function getGamesForAdmin(admin: AdminPermission): Game[] {
  if (admin.isMasterAdmin || admin.gamesAccessType === "all") return [...games];
  return games.filter((g) => admin.allowedGameIds.includes(g.id));
}

export const adminStore = {
  games: (adminId?: string) => {
    if (!adminId) return [...games];
    const admin = adminPermissions.find((a) => a.id === adminId);
    if (!admin) return [...games];
    return getGamesForAdmin(admin);
  },
  addGame: (name: string, imageUrl: string | null) => {
    const id = String(gameIdCounter++);
    globalForAdmin.gameIdCounter = gameIdCounter;
    games.push({ id, name, imageUrl });
    return games[games.length - 1];
  },
  deleteGame: (id: string) => {
    const i = games.findIndex((g) => g.id === id);
    if (i === -1) return false;
    games.splice(i, 1);
    return true;
  },
  renameGame: (id: string, name: string) => {
    const g = games.find((x) => x.id === id);
    if (!g) return null;
    g.name = name;
    return g;
  },

  gameModes: (gameId?: string) =>
    gameId ? gameModes.filter((m) => m.gameId === gameId) : [...gameModes],
  addGameMode: (gameId: string, name: string, imageUrl: string | null) => {
    const id = `m${modeIdCounter++}`;
    globalForAdmin.modeIdCounter = modeIdCounter;
    gameModes.push({ id, gameId, name, imageUrl });
    return gameModes[gameModes.length - 1];
  },
  deleteMode: (id: string) => {
    const i = gameModes.findIndex((m) => m.id === id);
    if (i === -1) return false;
    gameModes.splice(i, 1);
    return true;
  },
  renameMode: (id: string, name: string) => {
    const m = gameModes.find((x) => x.id === id);
    if (!m) return null;
    m.name = name;
    return m;
  },
  updateMode: (id: string, updates: { name?: string; imageUrl?: string | null }) => {
    const m = gameModes.find((x) => x.id === id);
    if (!m) return null;
    if (updates.name !== undefined) m.name = updates.name;
    if (updates.imageUrl !== undefined) m.imageUrl = updates.imageUrl;
    return m;
  },

  matches: (modeId?: string) => {
    const list = (modeId ? matches.filter((m) => m.gameModeId === modeId) : [...matches]).filter(
      (m) => m.status !== "cancelled",
    );
    return list.map((m) => {
      const count = matchParticipants.filter((mp) => mp.matchId === m.id).length;
      return { ...m, participantCount: count };
    });
  },
  addMatch: (
    gameModeId: string,
    title: string,
    entryFee: number,
    maxParticipants: number,
    scheduledAt: string,
    matchType: MatchType = "solo",
    prizePool: PrizePool = defaultPrizePool,
    map: string = "BERMUDA",
    image?: string | null
  ) => {
    const id = `match${matchIdCounter++}`;
    globalForAdmin.matchIdCounter = matchIdCounter;
    const posters = ["match_poster_1", "match_poster_2", "match_poster_3"];
    const randomPoster = posters[Math.floor(Math.random() * posters.length)];
    matches.push({
      id,
      gameModeId,
      title,
      entryFee,
      roomCode: null,
      roomPassword: null,
      status: "upcoming",
      maxParticipants,
      scheduledAt,
      registrationLocked: false,
      matchType,
      prizePool,
      map,
      image: image || randomPoster,
    });
    return matches[matches.length - 1];
  },
  updateMatchRoomInfo: (matchId: string, roomCode: string, roomPassword: string) => {
    const m = matches.find((x) => x.id === matchId);
    if (!m || m.status !== "upcoming") return null;
    m.roomCode = roomCode;
    m.roomPassword = roomPassword;
    return m;
  },
  startMatch: (matchId: string, roomCode?: string, roomPassword?: string) => {
    const m = matches.find((x) => x.id === matchId);
    if (!m || m.status !== "upcoming") return null;
    m.roomCode = roomCode ?? m.roomCode;
    m.roomPassword = roomPassword ?? m.roomPassword;
    if (!m.roomCode || !m.roomPassword) return null;
    m.status = "ongoing";
    m.registrationLocked = true;
    return m;
  },
  cancelMatch: (matchId: string) => {
    const idx = matches.findIndex((x) => x.id === matchId);
    const m = idx === -1 ? null : matches[idx];
    if (!m || m.status !== "upcoming") return null;
    const snapshot = { ...m };
    const participants = matchParticipants.filter((p) => p.matchId === matchId);
    for (const p of participants) {
      const u = users.find((x) => x.id === p.userId);
      if (u) {
        u.coins += m.entryFee;
        coinTransactions.push({
          id: nextTxId(),
          userId: p.userId,
          amount: m.entryFee,
          type: "refund",
          referenceId: matchId,
          description: `Refund: ${m.title} cancelled`,
          createdAt: new Date().toISOString(),
        });
      }
    }
    for (let i = matchParticipants.length - 1; i >= 0; i--) {
      if (matchParticipants[i].matchId === matchId) matchParticipants.splice(i, 1);
    }
    delete matchParticipantOrder[matchId];
    matches.splice(idx, 1);
    return snapshot;
  },
  finishMatch: (matchId: string) => {
    const m = matches.find((x) => x.id === matchId);
    if (!m || m.status !== "ongoing") return null;
    const participants = matchParticipants
      .filter((p) => p.matchId === matchId);
    const withRank = participants
      .filter((p) => typeof p.rank === "number" && p.rank >= 1)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const rewards = m.prizePool?.rankRewards ?? [];
    const cpk = m.prizePool?.coinsPerKill ?? 0;
    for (const p of withRank) {
      const totalKills = (p.teamMembers ?? []).reduce((s, t) => s + (t.kills ?? 0), 0);
      let coins = totalKills * cpk;
      for (const r of rewards) {
        if (p.rank! >= r.fromRank && p.rank! <= r.toRank) {
          coins += r.coins;
          break;
        }
      }
      if (coins > 0) {
        const u = users.find((x) => x.id === p.userId);
        if (u) {
          u.wonCoins += coins;
          u.lifetimeEarnedPoints = (u.lifetimeEarnedPoints ?? 0) + coins;
          coinTransactions.push({
            id: nextTxId(),
            userId: p.userId,
            amount: coins,
            type: "match_winning",
            referenceId: matchId,
            description: `Winning with match ${matchId}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    // Update matchesPlayed and totalKills stats for all participants
    for (const p of participants) {
      const u = users.find((x) => x.id === p.userId);
      if (u) {
        u.matchesPlayed = (u.matchesPlayed ?? 0) + 1;
        const totalKills = (p.teamMembers ?? []).reduce((s, t) => s + (t.kills ?? 0), 0);
        u.totalKills = (u.totalKills ?? 0) + totalKills;
      }
    }
    m.status = "completed";
    return m;
  },
  deleteMatch: (id: string) => {
    const i = matches.findIndex((m) => m.id === id);
    if (i === -1) return false;
    for (let j = matchParticipants.length - 1; j >= 0; j--) {
      if (matchParticipants[j].matchId === id) matchParticipants.splice(j, 1);
    }
    delete matchParticipantOrder[id];
    matches.splice(i, 1);
    return true;
  },
  matchPresets: (modeId?: string) => {
    const list = modeId ? matchPresets.filter((p) => p.gameModeId === modeId) : [...matchPresets];
    return list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  },
  getMatchPreset: (id: string) => matchPresets.find((p) => p.id === id) ?? null,
  addMatchPreset: (
    gameModeId: string,
    name: string,
    title: string,
    entryFee: number,
    maxParticipants: number,
    matchType: MatchType = "solo",
    prizePool: PrizePool = defaultPrizePool,
    map: string = "BERMUDA",
    image?: string | null,
  ) => {
    const id = `preset${matchPresetIdCounter++}`;
    globalForAdmin.matchPresetIdCounter = matchPresetIdCounter;
    matchPresets.push({
      id,
      gameModeId,
      name,
      title,
      entryFee,
      maxParticipants,
      matchType,
      map,
      prizePool,
      image: image ?? null,
      createdAt: new Date().toISOString(),
    });
    return matchPresets[matchPresets.length - 1];
  },
  updateMatchPreset: (
    id: string,
    updates: Partial<{
      name: string;
      title: string;
      entryFee: number;
      maxParticipants: number;
      matchType: MatchType;
      map: string;
      prizePool: PrizePool;
      image: string | null;
    }>,
  ) => {
    const p = matchPresets.find((x) => x.id === id);
    if (!p) return null;
    if (updates.name !== undefined) p.name = updates.name;
    if (updates.title !== undefined) p.title = updates.title;
    if (updates.entryFee !== undefined) p.entryFee = updates.entryFee;
    if (updates.maxParticipants !== undefined) p.maxParticipants = updates.maxParticipants;
    if (updates.matchType !== undefined) p.matchType = updates.matchType;
    if (updates.map !== undefined) p.map = updates.map;
    if (updates.prizePool !== undefined) p.prizePool = updates.prizePool;
    if (updates.image !== undefined) p.image = updates.image;
    return p;
  },
  deleteMatchPreset: (id: string) => {
    const i = matchPresets.findIndex((p) => p.id === id);
    if (i === -1) return false;
    matchPresets.splice(i, 1);
    return true;
  },
  createMatchesFromPreset: (presetId: string, gameModeId: string, scheduledAtList: string[]) => {
    const preset = matchPresets.find((p) => p.id === presetId);
    if (!preset || scheduledAtList.length === 0) return null;
    const created: Match[] = [];
    for (const scheduledAt of scheduledAtList) {
      const match = adminStore.addMatch(
        gameModeId,
        preset.title,
        preset.entryFee,
        preset.maxParticipants,
        scheduledAt,
        preset.matchType,
        preset.prizePool,
        preset.map,
        preset.image,
      );
      created.push(match);
    }
    return created;
  },
  renameMatch: (id: string, title: string) => {
    const m = matches.find((x) => x.id === id);
    if (!m) return null;
    m.title = title;
    return m;
  },
  updateMatch: (
    id: string,
    updates: Partial<{
      title: string;
      entryFee: number;
      maxParticipants: number;
      scheduledAt: string;
      matchType: MatchType;
      map: string;
      image: string | null;
      prizePool: PrizePool;
    }>,
  ) => {
    const m = matches.find((x) => x.id === id);
    if (!m || m.status !== "upcoming") return null;
    if (updates.title !== undefined) m.title = updates.title;
    if (updates.entryFee !== undefined) m.entryFee = updates.entryFee;
    if (updates.maxParticipants !== undefined) m.maxParticipants = updates.maxParticipants;
    if (updates.scheduledAt !== undefined) m.scheduledAt = updates.scheduledAt;
    if (updates.matchType !== undefined) m.matchType = updates.matchType;
    if (updates.map !== undefined) m.map = updates.map;
    if (updates.image !== undefined) m.image = updates.image ?? undefined;
    if (updates.prizePool !== undefined) m.prizePool = updates.prizePool;
    return m;
  },

  users: () => [...users],
  getSignupBonus: () => signupBonus,
  setSignupBonus: (amount: number) => {
    const a = Math.max(0, amount);
    signupBonus = a;
    globalForAdmin.signupBonus = a;
    return a;
  },
  addUser: (email: string, displayName: string, password: string, username?: string, referredBy?: string) => {
    const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) return null;
    if (!password || password.length < 6) return null;
    
    // Check if username is taken, otherwise generate/sanitize
    let finalUsername = username?.trim();
    if (!finalUsername) {
      const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      finalUsername = base;
      let attempt = 1;
      while (users.some((u) => u.username === finalUsername)) {
        finalUsername = `${base}${attempt++}`;
      }
    } else {
      if (users.some((u) => u.username === finalUsername)) {
        return null; // Username already exists
      }
    }

    const id = finalUsername;
    const bonus = signupBonus;
    const passwordHash = bcrypt.hashSync(password, 10);
    const user: User & { passwordHash?: string } = {
      id,
      email,
      displayName,
      coins: bonus,
      wonCoins: 0,
      isBlocked: false,
      passwordHash,
      lifetimeEarnedPoints: 0,
      matchesPlayed: 0,
      totalKills: 0,
      username: finalUsername,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    if (bonus > 0) {
      coinTransactions.push({
        id: nextTxId(),
        userId: id,
        amount: bonus,
        type: "signup_bonus",
        description: "Signup bonus",
        createdAt: new Date().toISOString(),
      });
    }

    // Process referral if enabled and referredBy is provided
    if (referralSystemEnabled && referredBy) {
      const referrer = users.find((u) => u.username?.toLowerCase() === referredBy.toLowerCase());
      if (referrer) {
        const refCoins = referralRewardCoins;
        const refId = nextReferralId();
        referrals.push({
          id: refId,
          referrerId: referrer.id,
          referredId: id,
          rewardCoins: refCoins,
          rewardGranted: true,
          createdAt: new Date().toISOString(),
        });
        if (refCoins > 0) {
          referrer.coins += refCoins;
          coinTransactions.push({
            id: nextTxId(),
            userId: referrer.id,
            amount: refCoins,
            type: "admin_add",
            description: `Referral reward for referring ${displayName}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return user;
  },
  signInUser: (email: string, password: string) => {
    const query = email.trim().toLowerCase();
    const u = users.find((x) => x.email?.toLowerCase() === query || x.username?.toLowerCase() === query);
    if (!u || u.isBlocked) return null;
    const hash = (u as User & { passwordHash?: string }).passwordHash;
    if (!hash || !bcrypt.compareSync(password, hash)) return null;
    const { passwordHash: _, ...user } = u as User & { passwordHash?: string };
    return user;
  },
  addCoins: (userId: string, amount: number, description?: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return null;
    u.coins += amount;
    coinTransactions.push({
      id: nextTxId(),
      userId,
      amount,
      type: "admin_add",
      description: description ?? "Admin added coins",
      createdAt: new Date().toISOString(),
    });
    return u;
  },
  addDepositRequest: (userId: string, amount: number, utr: string) => {
    const trimmed = utr.trim();
    if (depositRequests.some((r) => r.utr === trimmed)) return null;
    const id = nextDrId();
    const req: DepositRequest = {
      id,
      userId,
      amount,
      utr: trimmed,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    depositRequests.push(req);
    return req;
  },
  getDepositRequests: (status?: "pending" | "accepted" | "rejected") => {
    if (status) return depositRequests.filter((r) => r.status === status);
    return [...depositRequests];
  },
  getDepositRequest: (id: string) => depositRequests.find((r) => r.id === id),
  getDepositRequestsByUser: (userId: string) =>
    depositRequests.filter((r) => r.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  acceptDepositRequest: (id: string) => {
    const req = depositRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return null;
    req.status = "accepted";
    const u = users.find((x) => x.id === req.userId);
    if (u) {
      u.coins += req.amount;
      coinTransactions.push({
        id: nextTxId(),
        userId: req.userId,
        amount: req.amount,
        type: "deposit",
        description: "Deposited",
        referenceId: req.utr,
        createdAt: new Date().toISOString(),
      });
    }
    return req;
  },
  rejectDepositRequest: (id: string) => {
    const req = depositRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return null;
    req.status = "rejected";
    coinTransactions.push({
      id: nextTxId(),
      userId: req.userId,
      amount: req.amount,
      type: "deposit_failed",
      description: "Deposit rejected",
      referenceId: req.utr,
      createdAt: new Date().toISOString(),
    });
    return req;
  },
  blockDepositRequest: (id: string) => {
    const req = depositRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return null;
    req.status = "rejected";
    const u = users.find((x) => x.id === req.userId);
    if (u) u.isBlocked = true;
    coinTransactions.push({
      id: nextTxId(),
      userId: req.userId,
      amount: req.amount,
      type: "deposit_failed",
      description: "Deposit rejected (user blocked)",
      referenceId: req.utr,
      createdAt: new Date().toISOString(),
    });
    return req;
  },
  getWithdrawalCharge: () => withdrawalChargePercent,
  setWithdrawalCharge: (percent: number) => {
    const p = Math.max(0, Math.min(100, percent));
    withdrawalChargePercent = p;
    globalForAdmin.withdrawalChargePercent = p;
    return p;
  },
  addWithdrawalRequest: (userId: string, amount: number, upiId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u || u.wonCoins < amount) return null;
    u.wonCoins -= amount;
    const id = nextWrId();
    const req: WithdrawalRequest = {
      id,
      userId,
      amount,
      upiId,
      status: "pending",
      chargePercent: withdrawalChargePercent,
      createdAt: new Date().toISOString(),
    };
    withdrawalRequests.push(req);
    return req;
  },
  getWithdrawalRequests: (status?: "pending" | "accepted" | "rejected") => {
    if (status) return withdrawalRequests.filter((r) => r.status === status);
    return [...withdrawalRequests];
  },
  getWithdrawalRequestsByUser: (userId: string) =>
    withdrawalRequests.filter((r) => r.userId === userId),
  getWithdrawalRequest: (id: string) => withdrawalRequests.find((r) => r.id === id),
  acceptWithdrawalRequest: (id: string) => {
    const req = withdrawalRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return null;
    req.status = "accepted";
    coinTransactions.push({
      id: nextTxId(),
      userId: req.userId,
      amount: -req.amount,
      type: "withdraw",
      description: "Withdraw",
      referenceId: req.upiId,
      createdAt: new Date().toISOString(),
    });
    return req;
  },
  rejectWithdrawalRequest: (id: string, note: string) => {
    const req = withdrawalRequests.find((r) => r.id === id);
    if (!req || req.status !== "pending") return null;
    req.status = "rejected";
    req.rejectNote = note;
    const u = users.find((x) => x.id === req.userId);
    if (u) u.wonCoins += req.amount;
    coinTransactions.push({
      id: nextTxId(),
      userId: req.userId,
      amount: req.amount,
      type: "refund",
      description: note?.trim() ? `Withdrawal rejected: ${note.trim()}` : "Withdrawal rejected - refunded",
      referenceId: req.upiId,
      createdAt: new Date().toISOString(),
    });
    return req;
  },
  transactions: (userId?: string) => {
    const list = userId
      ? coinTransactions.filter((t) => t.userId === userId)
      : [...coinTransactions];
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  blockUser: (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return false;
    u.isBlocked = true;
    return true;
  },
  unblockUser: (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return false;
    u.isBlocked = false;
    return true;
  },
  deleteUser: (userId: string) => {
    const i = users.findIndex((x) => x.id === userId);
    if (i === -1) return false;
    users.splice(i, 1);
    return true;
  },

  getGame: (id: string) => games.find((g) => g.id === id),
  getMode: (id: string) => gameModes.find((m) => m.id === id),
  getMatch: (id: string) => matches.find((m) => m.id === id),
  getUser: (id: string) => users.find((u) => u.id === id),
  getParticipantsForMatch: (matchId: string) => {
    const list = matchParticipants.filter((p) => p.matchId === matchId);
    const order = matchParticipantOrder[matchId];
    if (order && order.length === list.length) {
      const byId = new Map(list.map((p) => [p.id, p]));
      return order.map((id) => byId.get(id)).filter(Boolean) as MatchParticipant[];
    }
    return list.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  },
  updateParticipantKills: (matchId: string, participantId: string, kills: number[]) => {
    const p = matchParticipants.find((x) => x.matchId === matchId && x.id === participantId);
    if (!p) return null;
    p.teamMembers.forEach((tm, i) => {
      tm.kills = kills[i] ?? tm.kills ?? 0;
    });
    return p;
  },
  updateParticipantRank: (matchId: string, participantId: string, rank: number) => {
    const list = matchParticipants.filter((p) => p.matchId === matchId);
    const p = list.find((x) => x.id === participantId);
    if (!p || rank < 1 || rank > list.length) return null;
    let order = matchParticipantOrder[matchId];
    if (!order || order.length !== list.length) {
      order = list.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()).map((x) => x.id);
      matchParticipantOrder[matchId] = order;
    }
    const idx = order.indexOf(participantId);
    if (idx === -1) return null;
    const rankIdx = rank - 1;
    p.rank = rank;
    [order[idx], order[rankIdx]] = [order[rankIdx], order[idx]];
    return p;
  },
  addMatchParticipant: (matchId: string, userId: string, teamMembers: { inGameName: string; inGameUid: string }[]) => {
    const id = `mp${matchParticipantIdCounter++}`;
    globalForAdmin.adminStoreMatchParticipantIdCounter = matchParticipantIdCounter;
    const p: MatchParticipant = {
      id,
      matchId,
      userId,
      teamMembers: teamMembers.map((tm) => ({ ...tm, kills: 0 })),
      joinedAt: new Date().toISOString(),
    };
    matchParticipants.push(p);
    return p;
  },

  joinMatch: (
    matchId: string,
    appUserId: string,
    inGameName: string,
    inGameUid: string,
    teamMembers?: { inGameName: string; inGameUid: string }[]
  ): { error?: string } | null => {
    const m = matches.find((x) => x.id === matchId);
    if (!m) return { error: "Match not found" };
    if (m.status !== "upcoming") return { error: "Registration closed" };
    if (m.registrationLocked) return { error: "Registration locked" };
    const u = users.find((x) => x.id === appUserId);
    if (!u) return { error: "User not found" };
    if (u.isBlocked) return { error: "Account is blocked" };
    const totalBalance = u.coins + u.wonCoins;
    if (totalBalance < m.entryFee) return { error: "Insufficient coins" };
    const existing = matchParticipants.find((p) => p.matchId === matchId && p.userId === appUserId);
    if (existing) return { error: "Already registered" };
    const participants = matchParticipants.filter((p) => p.matchId === matchId);
    if (participants.length >= m.maxParticipants) return { error: "Match is full" };
    const members = [{ inGameName, inGameUid }, ...(teamMembers ?? [])].slice(0, 4);
    const newId = matchParticipantIdCounter++;
    globalForAdmin.adminStoreMatchParticipantIdCounter = matchParticipantIdCounter;
    matchParticipants.push({
      id: `mp${newId}`,
      matchId,
      userId: appUserId,
      teamMembers: members.map((tm) => ({ ...tm, kills: 0 })),
      joinedAt: new Date().toISOString(),
    });
    if (m.entryFee > 0) {
      let deductCoins = 0;
      let deductWonCoins = 0;
      if (u.coins >= m.entryFee) {
        deductCoins = m.entryFee;
      } else {
        deductCoins = u.coins;
        deductWonCoins = m.entryFee - deductCoins;
      }
      u.coins -= deductCoins;
      u.wonCoins -= deductWonCoins;
      coinTransactions.push({
        id: nextTxId(),
        userId: appUserId,
        amount: -m.entryFee,
        type: "match_entry",
        referenceId: matchId,
        description: "Match entry fee",
        createdAt: new Date().toISOString(),
      });
    }
    return null;
  },

  getDepositQrUrl: () => depositQrUrl,
  setDepositQrUrl: (url: string | null) => {
    depositQrUrl = url;
    return depositQrUrl;
  },
  getCustomerSupportUrl: () => customerSupportUrl,
  setCustomerSupportUrl: (url: string | null) => {
    customerSupportUrl = url;
    globalForAdmin.customerSupportUrl = url;
    return customerSupportUrl;
  },

  // Admin auth & permissions
  login: async (adminname: string, password: string): Promise<AdminPermission | null> => {
    const admin = adminPermissions.find((a) => a.adminname.toLowerCase() === adminname.toLowerCase());
    if (!admin) return null;
    const ok = await bcrypt.compare(password, admin.passwordHash);
    return ok ? admin : null;
  },
  getAdminById: (id: string) => {
    const admin = adminPermissions.find((a) => a.id === id) ?? null;
    if (!admin) return null;
    if (!admin.tabAccess) {
      admin.tabAccess = normalizeTabAccess(admin);
    }
    return admin;
  },
  getAllAdmins: () =>
    adminPermissions.map((a) => {
      if (!a.tabAccess) a.tabAccess = normalizeTabAccess(a);
      return { ...a, passwordHash: "[hidden]" };
    }),
  createAdmin: (
    adminname: string,
    password: string,
    opts: {
      tabAccess: Partial<AdminTabAccess>;
    }
  ): AdminPermission | null => {
    if (adminPermissions.some((a) => a.adminname.toLowerCase() === adminname.toLowerCase())) return null;
    const id = `admin-${adminIdCounter++}`;
    globalForAdmin.adminIdCounter = adminIdCounter;
    const tabAccess = { ...emptyTabAccess(), ...opts.tabAccess };
    const legacy = legacyPermissionsFromTabAccess(tabAccess);
    const admin: AdminPermission = {
      id,
      adminname,
      passwordHash: bcrypt.hashSync(password, 10),
      isMasterAdmin: false,
      usersAccess: legacy.usersAccess,
      coinsAccess: legacy.coinsAccess,
      gamesAccessType: legacy.gamesAccessType,
      allowedGameIds: legacy.allowedGameIds,
      tabAccess: normalizeTabAccess({
        isMasterAdmin: false,
        usersAccess: legacy.usersAccess,
        coinsAccess: legacy.coinsAccess,
        gamesAccessType: legacy.gamesAccessType,
        allowedGameIds: legacy.allowedGameIds,
        tabAccess,
      }),
      createdAt: new Date().toISOString(),
    };
    adminPermissions.push(admin);
    return admin;
  },
  deleteAdmin: (adminId: string): boolean => {
    const admin = adminPermissions.find((a) => a.id === adminId);
    if (!admin || admin.isMasterAdmin) return false;
    const i = adminPermissions.findIndex((a) => a.id === adminId);
    if (i === -1) return false;
    adminPermissions.splice(i, 1);
    return true;
  },
  updateAdminPassword: (adminId: string, newPassword: string): boolean => {
    const admin = adminPermissions.find((a) => a.id === adminId);
    if (!admin) return false;
    admin.passwordHash = bcrypt.hashSync(newPassword, 10);
    return true;
  },
  getDefaultGameId: () => Promise.resolve("default-game-free-fire"),
  getAnnouncementText: () => Promise.resolve(announcementText),
  setAnnouncementText: (text: string | null) => {
    announcementText = text ?? "";
    globalForAdmin.announcementText = text ?? "";
    return Promise.resolve(announcementText);
  },
  getBannerImageUrl: () => Promise.resolve(bannerImageUrl),
  setBannerImageUrl: (url: string | null) => {
    bannerImageUrl = url ?? "";
    globalForAdmin.bannerImageUrl = url ?? "";
    return Promise.resolve(bannerImageUrl);
  },
  canAccessGames: (adminId: string) => {
    const admin = adminStore.getAdminById(adminId);
    return admin ? (admin.isMasterAdmin || admin.gamesAccessType === "all" || admin.allowedGameIds.length > 0) : false;
  },
  canAccessUsers: (adminId: string) => adminStore.getAdminById(adminId)?.usersAccess ?? false,
  canAccessCoins: (adminId: string) => adminStore.getAdminById(adminId)?.coinsAccess ?? false,
  isMasterAdmin: (adminId: string) => adminStore.getAdminById(adminId)?.isMasterAdmin ?? false,
  getBanners: () => {
    seedMockData();
    return Promise.resolve(appBanners);
  },
  addBanner: (imageUrl: string, linkUrl: string, displayPlayCarousel: boolean, displayEarn: boolean) => {
    const id = nextBannerId();
    const banner: AppBanner = {
      id,
      imageUrl,
      linkUrl,
      displayPlayCarousel,
      displayEarn,
      createdAt: new Date().toISOString()
    };
    appBanners.push(banner);
    return Promise.resolve(banner);
  },
  updateBanner: (id: string, imageUrl: string, linkUrl: string, displayPlayCarousel: boolean, displayEarn: boolean) => {
    const banner = appBanners.find((b) => b.id === id);
    if (!banner) return Promise.resolve(null);
    banner.imageUrl = imageUrl;
    banner.linkUrl = linkUrl;
    banner.displayPlayCarousel = displayPlayCarousel;
    banner.displayEarn = displayEarn;
    return Promise.resolve(banner);
  },
  deleteBanner: (id: string) => {
    const i = appBanners.findIndex((b) => b.id === id);
    if (i === -1) return Promise.resolve(false);
    appBanners.splice(i, 1);
    return Promise.resolve(true);
  },
  getReferralSettings: () => ({
    enabled: referralSystemEnabled,
    rewardCoins: referralRewardCoins,
    bannerUrl: referralBannerUrl,
  }),
  setReferralSettings: (enabled: boolean, rewardCoins: number, bannerUrl: string) => {
    referralSystemEnabled = enabled;
    referralRewardCoins = rewardCoins;
    referralBannerUrl = bannerUrl;
    globalForAdmin.referralSystemEnabled = enabled;
    globalForAdmin.referralRewardCoins = rewardCoins;
    globalForAdmin.referralBannerUrl = bannerUrl;
    return { enabled, rewardCoins, bannerUrl };
  },
  getReferralsList: () => {
    return referrals.map((r) => {
      const referrer = users.find((u) => u.id === r.referrerId);
      const referred = users.find((u) => u.id === r.referredId);
      return {
        id: r.id,
        referrerId: r.referrerId,
        referrerName: referrer?.displayName ?? "Unknown",
        referredId: r.referredId,
        referredName: referred?.displayName ?? "Unknown",
        rewardCoins: r.rewardCoins,
        rewardGranted: r.rewardGranted,
        createdAt: r.createdAt,
      };
    });
  },
  updateFcmToken: (userId: string, token: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return false;
    (u as { fcmToken?: string }).fcmToken = token;
    return true;
  },
  clearFcmToken: (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return false;
    delete (u as { fcmToken?: string }).fcmToken;
    return true;
  },
  clearFcmTokenByValue: (token: string) => {
    const u = users.find((x) => (x as { fcmToken?: string }).fcmToken === token);
    if (!u) return false;
    delete (u as { fcmToken?: string }).fcmToken;
    return true;
  },
  getFcmTokensForTarget: (target: "all" | "active" | "blocked") => {
    return users
      .filter((u) => {
        const token = (u as { fcmToken?: string }).fcmToken;
        if (!token) return false;
        if (target === "active") return !u.isBlocked;
        if (target === "blocked") return !!u.isBlocked;
        return true;
      })
      .map((u) => ({ userId: u.id, token: (u as { fcmToken: string }).fcmToken }));
  },
  getFcmTokensForUserIds: (userIds: string[]) => {
    const idSet = new Set(userIds.filter(Boolean));
    return users
      .filter((u) => idSet.has(u.id) && !u.isBlocked && (u as { fcmToken?: string }).fcmToken)
      .map((u) => ({ userId: u.id, token: (u as { fcmToken: string }).fcmToken }));
  },
  listFcmDeviceRegistrations: () => {
    return users
      .filter((u) => (u as { fcmToken?: string }).fcmToken)
      .map((u) => ({
        userId: u.id,
        tokenSuffix: String((u as { fcmToken: string }).fcmToken).slice(-8),
        isBlocked: !!u.isBlocked,
      }));
  },

  getDashboardStats: (): DashboardStats => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const isWithinDays = (iso: string | undefined, days: number) => {
      if (!iso) return false;
      return now - new Date(iso).getTime() <= days * dayMs;
    };

    const activeMatches = matches.filter((m) => m.status !== "cancelled");
    const upcomingMatches = activeMatches.filter((m) => m.status === "upcoming");
    const ongoingMatches = activeMatches.filter((m) => m.status === "ongoing");

    const participantCount = (matchId: string) =>
      matchParticipants.filter((mp) => mp.matchId === matchId).length;

    const upcomingWithCounts = upcomingMatches.map((m) => {
      const count = participantCount(m.id);
      const fillRate = m.maxParticipants > 0 ? count / m.maxParticipants : 0;
      return { ...m, participantCount: count, fillRate };
    });

    const avgUpcomingFillRate =
      upcomingWithCounts.length > 0
        ? upcomingWithCounts.reduce((sum, m) => sum + m.fillRate, 0) / upcomingWithCounts.length
        : 0;

    const entryFeesCollected = [...upcomingMatches, ...ongoingMatches].reduce(
      (sum, m) => sum + m.entryFee * participantCount(m.id),
      0,
    );

    const acceptedDeposits = depositRequests.filter((d) => d.status === "accepted");
    const acceptedWithdrawals = withdrawalRequests.filter((w) => w.status === "accepted");
    const pendingWithdrawalsList = withdrawalRequests.filter((w) => w.status === "pending");
    const pendingDepositsList = depositRequests.filter((d) => d.status === "pending");

    const totalDeposits = acceptedDeposits.reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawals = acceptedWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    return {
      generatedAt: new Date().toISOString(),
      users: {
        total: users.length,
        blocked: users.filter((u) => u.isBlocked).length,
        pushEnabled: users.filter((u) => u.fcmToken).length,
        activePlayers: users.filter((u) => (u.matchesPlayed ?? 0) > 0).length,
        newToday: users.filter((u) => isWithinDays(u.createdAt, 1)).length,
        new7d: users.filter((u) => isWithinDays(u.createdAt, 7)).length,
        new30d: users.filter((u) => isWithinDays(u.createdAt, 30)).length,
        walletCoins: users.reduce((sum, u) => sum + (u.coins ?? 0), 0),
        withdrawableWinnings: users.reduce((sum, u) => sum + (u.wonCoins ?? 0), 0),
      },
      money: {
        totalDeposits,
        totalWithdrawals,
        netFlow: totalDeposits - totalWithdrawals,
        pendingDepositsCount: pendingDepositsList.length,
        pendingDepositsAmount: pendingDepositsList.reduce((sum, d) => sum + d.amount, 0),
        pendingWithdrawalsCount: pendingWithdrawalsList.length,
        pendingWithdrawalsAmount: pendingWithdrawalsList.reduce((sum, w) => sum + w.amount, 0),
        depositsToday: acceptedDeposits
          .filter((d) => isWithinDays(d.createdAt, 1))
          .reduce((sum, d) => sum + d.amount, 0),
        deposits7d: acceptedDeposits
          .filter((d) => isWithinDays(d.createdAt, 7))
          .reduce((sum, d) => sum + d.amount, 0),
      },
      matches: {
        upcoming: upcomingMatches.length,
        ongoing: ongoingMatches.length,
        completed: activeMatches.filter((m) => m.status === "completed" || m.status === "ended").length,
        completed7d: activeMatches.filter(
          (m) =>
            (m.status === "completed" || m.status === "ended") && isWithinDays(m.scheduledAt, 7),
        ).length,
        solo: activeMatches.filter((m) => m.matchType === "solo").length,
        duo: activeMatches.filter((m) => m.matchType === "duo").length,
        squad: activeMatches.filter((m) => m.matchType === "squad").length,
        avgUpcomingFillRate,
        entryFeesCollected,
      },
      upcomingMatches: [...upcomingWithCounts]
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          title: m.title,
          scheduledAt: m.scheduledAt,
          maxParticipants: m.maxParticipants,
          entryFee: m.entryFee,
          matchType: m.matchType,
          participantCount: m.participantCount,
          fillRate: m.fillRate,
        })),
      pendingWithdrawals: pendingWithdrawalsList
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, 5)
        .map((w) => {
          const user = users.find((u) => u.id === w.userId);
          return {
            id: w.id,
            userId: w.userId,
            amount: w.amount,
            upiId: w.upiId,
            createdAt: w.createdAt,
            userDisplayName: user?.displayName ?? w.userId,
            userEmail: user?.email ?? "",
          };
        }),
    };
  },
};
