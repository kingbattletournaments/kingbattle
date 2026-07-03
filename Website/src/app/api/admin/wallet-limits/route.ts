import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  const store = getStore();
  const [minWithdrawalAmount, minDepositAmount] = await Promise.all([
    store.getMinWithdrawalAmount(),
    store.getMinDepositAmount(),
  ]);
  return NextResponse.json({ minWithdrawalAmount, minDepositAmount });
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!admin.usersAccess && !admin.coinsAccess) return NextResponse.json({ error: "No access" }, { status: 403 });
  try {
    const body = await request.json();
    const store = getStore();
    let minWithdrawalAmount = await store.getMinWithdrawalAmount();
    let minDepositAmount = await store.getMinDepositAmount();

    if (body.minWithdrawalAmount !== undefined) {
      const amount = Number(body.minWithdrawalAmount);
      if (isNaN(amount) || amount < 1) {
        return NextResponse.json({ error: "Minimum withdrawal must be at least 1 coin" }, { status: 400 });
      }
      minWithdrawalAmount = await store.setMinWithdrawalAmount(amount);
    }
    if (body.minDepositAmount !== undefined) {
      const amount = Number(body.minDepositAmount);
      if (isNaN(amount) || amount < 1) {
        return NextResponse.json({ error: "Minimum deposit must be at least 1 coin" }, { status: 400 });
      }
      minDepositAmount = await store.setMinDepositAmount(amount);
    }

    return NextResponse.json({ minWithdrawalAmount, minDepositAmount });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
