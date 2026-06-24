import { getFirebaseMessaging, isFirebaseConfigured } from "./firebase-admin";

export type PushTarget = "all" | "active" | "blocked";

export type SendPushResult = {
  successCount: number;
  failureCount: number;
  totalTokens: number;
  messageIds?: string[];
  targetedUsers?: { userId: string; tokenSuffix: string }[];
  errors?: string[];
  invalidTokens?: string[];
};

const BATCH_SIZE = 500;
export const FCM_CHANNEL_ID = "king_battle_alerts_v4";

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

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
  targetedUsers?: { userId: string; tokenSuffix: string }[],
): Promise<SendPushResult> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    throw new Error(getFirebaseConfigError() ?? "Firebase messaging unavailable");
  }

  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (uniqueTokens.length === 0) {
    return { successCount: 0, failureCount: 0, totalTokens: 0, targetedUsers };
  }

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];
  const invalidTokens: string[] = [];
  const messageIds: string[] = [];

  for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
    const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: {
        title,
        body,
        ...(link ? { link } : {}),
      },
      android: {
        priority: "high",
        ttl: 86_400_000,
        notification: {
          channelId: FCM_CHANNEL_ID,
          title,
          body,
          priority: "high" as const,
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: "public" as const,
          clickAction: "OPEN_MAIN",
        },
      },
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((resp, index) => {
      if (resp.success) {
        if (resp.messageId) messageIds.push(resp.messageId);
        return;
      }
      if (!resp.error) return;
      const token = batch[index];
      const msg = `${resp.error.code}: ${resp.error.message} (token …${token?.slice(-8) ?? "?"})`;
      errors.push(msg);
      console.error("FCM delivery error:", msg);
      if (token && INVALID_TOKEN_CODES.has(resp.error.code)) {
        invalidTokens.push(token);
      }
    });
  }

  return {
    successCount,
    failureCount,
    totalTokens: uniqueTokens.length,
    messageIds,
    targetedUsers,
    errors,
    invalidTokens,
  };
}
