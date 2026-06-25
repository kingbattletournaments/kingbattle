export type DashboardUpcomingMatch = {
  id: string;
  title: string;
  scheduledAt: string;
  maxParticipants: number;
  entryFee: number;
  matchType: string;
  participantCount: number;
  fillRate: number;
};

export type DashboardPendingWithdrawal = {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  createdAt: string;
  userDisplayName: string;
  userEmail: string;
};

export type DashboardStats = {
  generatedAt: string;
  users: {
    total: number;
    blocked: number;
    pushEnabled: number;
    activePlayers: number;
    newToday: number;
    new7d: number;
    new30d: number;
    walletCoins: number;
    withdrawableWinnings: number;
  };
  money: {
    totalDeposits: number;
    totalWithdrawals: number;
    netFlow: number;
    pendingDepositsCount: number;
    pendingDepositsAmount: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsAmount: number;
    depositsToday: number;
    deposits7d: number;
  };
  matches: {
    upcoming: number;
    ongoing: number;
    completed: number;
    completed7d: number;
    solo: number;
    duo: number;
    squad: number;
    avgUpcomingFillRate: number;
    entryFeesCollected: number;
  };
  upcomingMatches: DashboardUpcomingMatch[];
  pendingWithdrawals: DashboardPendingWithdrawal[];
};
