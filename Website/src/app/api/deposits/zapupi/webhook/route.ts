import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

const ZAP_STATUS_URL = "https://pay.zapupi.com/api/order-status";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { order_id, status, utr, environment } = data;

    if (!order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const store = getStore();
    const zapKey = process.env.ZAPUPI_KEY || "test";

    // 1. Double confirm payment via Order Status API if not in test/sandbox mode
    if (zapKey !== "test" && environment !== "test") {
      const response = await fetch(ZAP_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zap_key: zapKey,
          order_id: order_id
        })
      });

      const verifyData = await response.json();
      if (!response.ok || verifyData.status !== "success" || verifyData.data.status !== "Success") {
        return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
      }
    } else {
      // Sandbox/Test mode validation
      if (status !== "Success") {
        return NextResponse.json({ error: "Payment status is not Success" }, { status: 400 });
      }
    }

    // 2. Locate the pending deposit request where UTR is matching order_id
    const depositReqs = await store.getDepositRequests("pending");
    const matchedReq = depositReqs.find((r) => r.utr === order_id);

    if (!matchedReq) {
      // Might have been accepted already
      return NextResponse.json({ status: "ok", message: "Already processed or request not found" });
    }

    // 3. Accept the deposit request (increments balance and writes transaction)
    await store.acceptDepositRequest(matchedReq.id);

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message || "Webhook processing error" }, { status: 500 });
  }
}
