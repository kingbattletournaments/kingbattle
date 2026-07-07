import type { getStore } from "@/lib/store";

export type UserTransactionFeedItem = {
  id: string;
  amount: number;
  type: "credit" | "debit";
  note: string;
  status?: "pending" | "successful" | "failed" | "refunded";
  createdAt: string;
};

type Store = ReturnType<typeof getStore>;

export async function buildUserTransactionFeed(
  store: Store,
  userId: string,
): Promise<UserTransactionFeedItem[]> {
  const [transactions, withdrawals, depositReqs] = await Promise.all([
    store.transactions(userId),
    store.getWithdrawalRequestsByUser(userId),
    store.getDepositRequestsByUser(userId),
  ]);

  const txItems: UserTransactionFeedItem[] = transactions.map((t) => {
    const isCredit =
      t.type === "admin_add" ||
      t.type === "refund" ||
      t.type === "deposit" ||
      t.type === "signup_bonus" ||
      t.type === "match_winning";
    let status: UserTransactionFeedItem["status"];
    let note = t.description ?? t.type;
    if (t.type === "deposit") {
      status = "successful";
      note = t.description?.trim() || "Deposit successful";
    } else if (t.type === "withdraw") {
      status = "successful";
      note = t.description?.trim() || "Withdraw";
    } else if (
      t.type === "refund" &&
      (t.description?.includes("Withdrawal") || t.description?.includes("refunded"))
    ) {
      status = "refunded";
      note = t.description ?? "Withdrawal refunded";
    } else if (t.type === "withdraw_failed") {
      status = "refunded";
      note = t.description ?? "Withdrawal refunded";
    } else if (t.type === "deposit_failed") {
      status = "failed";
      note = t.description ?? "Deposit rejected";
    } else if (t.type === "admin_add") {
      note = t.description?.trim() || "Admin added";
    } else if (t.type === "signup_bonus") {
      note = "Signup bonus";
    } else if (t.type === "match_winning") {
      note = t.description?.trim() || "Match winning";
    } else if (t.type === "refund") {
      note = t.description?.trim() || "Refund";
    } else if (t.type === "match_entry") {
      note = t.description?.trim() || "Match entry";
    }
    return {
      id: t.id,
      amount: t.amount,
      type: isCredit ? "credit" : "debit",
      note,
      status,
      createdAt: t.createdAt,
    };
  });

  const pendingWithdrawals: UserTransactionFeedItem[] = withdrawals
    .filter((w) => w.status === "pending")
    .map((w) => ({
      id: w.id,
      amount: -w.amount,
      type: "debit" as const,
      note: "Withdraw",
      status: "pending" as const,
      createdAt: w.createdAt,
    }));

  const pendingDeposits: UserTransactionFeedItem[] = depositReqs
    .filter((d) => d.status === "pending")
    .map((d) => ({
      id: d.id,
      amount: d.amount,
      type: "credit" as const,
      note: "Deposit",
      status: "pending" as const,
      createdAt: d.createdAt,
    }));

  return [...txItems, ...pendingWithdrawals, ...pendingDeposits].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
