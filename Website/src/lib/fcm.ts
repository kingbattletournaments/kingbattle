import { getFirebaseMessaging, isFirebaseConfigured } from "./firebase-admin";

export type PushTarget = "all" | "active" | "blocked";

export type SendPushResult = {
  successCount: number;
  failureCount: number;
  totalTokens: number;
};

const BATCH_SIZE = 500;

export function getFirebaseConfigError(): string | null {
  if (!isFirebaseConfigured()) {
    return "Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY on the server.";
  }
  return null;
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  link?: string | null,
): Promise<SendPushResult> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    throw new Error(getFirebaseConfigError() ?? "Firebase messaging unavailable");
  }

  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return { successCount: 0, failureCount: 0, totalTokens: 0 };
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
    const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: link ? { title, body, link } : { title, body },
      android: {
        priority: "high",
        notification: {
          channelId: "king_battle_notifications",
          priority: "high",
        },
      },
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
  }

  return { successCount, failureCount, totalTokens: uniqueTokens.length };
}
