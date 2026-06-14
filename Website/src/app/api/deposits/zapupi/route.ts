import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";

const MAX_DEPOSIT = 1_000_000;
const ZAP_CREATE_URL = "https://pay.zapupi.com/api/create-order";

// Default urls used by Android client to intercept transaction status
const SUCCESS_URL = "https://zapupi.com/payment?s=s";
const FAILED_URL = "https://zapupi.com/payment?s=f";
const TIMEOUT_URL = "https://zapupi.com/payment?s=t";

export async function POST(request: Request) {
  try {
    const userId = await getAppUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amount } = body;
    const num = Number(amount);

    if (isNaN(num) || num <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    if (num > MAX_DEPOSIT) {
      return NextResponse.json({ error: "Amount exceeds maximum" }, { status: 400 });
    }

    const store = getStore();
    const user = await store.getUser(userId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.isBlocked) return NextResponse.json({ error: "Account is blocked" }, { status: 403 });

    const orderId = `DEP-${userId.substring(0, 5)}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const zapKey = process.env.ZAPUPI_KEY || "test";
    const webhookUrl = process.env.ZAPUPI_WEBHOOK_URL || "";

    if (zapKey === "test") {
      // Sandbox/Test mode: auto-create order record in DB and return success redirect URL
      const dbReq = await store.addDepositRequest(userId, num, orderId);
      if (!dbReq) {
        return NextResponse.json({ error: "Order creation failed in database" }, { status: 400 });
      }

      // We direct the webview to the success URL after a 3 second delay mock page
      // Or redirect to success immediately. Let's return the success URL directly with order_id appended.
      const mockPaymentUrl = `${SUCCESS_URL}&order_id=${orderId}&amount=${num}`;
      return NextResponse.json({
        status: "success",
        payment_url: mockPaymentUrl,
        order_id: orderId,
        environment: "test"
      });
    }

    // Call actual ZapUPI API
    const response = await fetch(ZAP_CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zap_key: zapKey,
        order_id: orderId,
        amount: num.toFixed(2),
        remark: `Deposit | ${userId}`,
        success_url: SUCCESS_URL,
        failed_url: FAILED_URL,
        timeout_url: TIMEOUT_URL,
        ...(webhookUrl ? { webhook_url: webhookUrl } : {})
      })
    });

    const data = await response.json();
    if (response.ok && data.status === "success") {
      // Insert pending deposit request into database, using orderId as the UTR key
      await store.addDepositRequest(userId, num, orderId);
      return NextResponse.json({
        status: "success",
        payment_url: data.payment_url,
        order_id: orderId,
        environment: data.environment || "cashier"
      });
    } else {
      return NextResponse.json({
        error: data.message || "Failed to create ZapUPI order"
      }, { status: 400 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
