import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAppUserId } from "@/lib/app-auth";

const ZAP_STATUS_URL = "https://pay.zapupi.com/api/order-status";

export async function GET(request: Request) {
  try {
    const userId = await getAppUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const store = getStore();
    const zapKey = process.env.ZAPUPI_KEY || "test";

    let isSuccess = false;
    let bankUtr = "";

    // 1. Verify with order status API if not in test/sandbox mode
    if (zapKey !== "test") {
      const response = await fetch(ZAP_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zap_key: zapKey,
          order_id: orderId
        })
      });

      const verifyData = await response.json();
      if (response.ok && verifyData.status === "success" && verifyData.data.status === "Success") {
        isSuccess = true;
        bankUtr = verifyData.data.utr || "";
      }
    } else {
      // Sandbox/Test mode logic: any request with "test" key is treated as Success for testing
      isSuccess = true;
      bankUtr = "DUMMY_UTR_123";
    }

    if (isSuccess) {
      // 2. Locate the pending request where UTR matches the order_id
      const depositReqs = await store.getDepositRequests("pending");
      const matchedReq = depositReqs.find((r) => r.utr === orderId && r.userId === userId);

      if (matchedReq) {
        // 3. Mark request as accepted and credit balance
        await store.acceptDepositRequest(matchedReq.id);
      }

      return NextResponse.json({ status: "Success", orderId });
    }

    return NextResponse.json({ status: "Pending", orderId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
