import { getFirebaseConfigError, sendPushToTokens } from "./fcm";

export type MatchRoomNotificationResult = {
  attempted: number;
  successCount: number;
  failureCount: number;
  skippedNoToken: number;
};

export async function notifyMatchParticipantsRoomInfo(input: {
  matchId: string;
  matchTitle: string;
  roomCode: string;
  roomPassword: string;
  participantUserIds: string[];
  getTokensForUsers: (userIds: string[]) => Promise<{ userId: string; token: string }[]>;
  clearInvalidToken?: (token: string) => Promise<boolean>;
}): Promise<MatchRoomNotificationResult> {
  const firebaseError = getFirebaseConfigError();
  if (firebaseError) {
    console.warn("Match room notification skipped:", firebaseError);
    return { attempted: 0, successCount: 0, failureCount: 0, skippedNoToken: 0 };
  }

  const uniqueUserIds = Array.from(new Set(input.participantUserIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return { attempted: 0, successCount: 0, failureCount: 0, skippedNoToken: 0 };
  }

  const tokenRows = await input.getTokensForUsers(uniqueUserIds);
  const tokens = tokenRows.map((row) => row.token);
  const skippedNoToken = uniqueUserIds.length - new Set(tokenRows.map((row) => row.userId)).size;

  if (tokens.length === 0) {
    return { attempted: 0, successCount: 0, failureCount: 0, skippedNoToken };
  }

  const title = `Match Started — ${input.matchTitle}`;
  const body = `Room ID: ${input.roomCode}\nPassword: ${input.roomPassword}`;
  const link = `match:${input.matchId}`;

  const result = await sendPushToTokens(
    tokens,
    title,
    body,
    link,
    tokenRows.map((row) => ({ userId: row.userId, tokenSuffix: row.token.slice(-8) })),
    {
      type: "match_started",
      matchId: input.matchId,
      roomCode: input.roomCode,
      roomPassword: input.roomPassword,
    },
  );

  if (result.invalidTokens?.length && input.clearInvalidToken) {
    await Promise.all(result.invalidTokens.map((token) => input.clearInvalidToken!(token)));
  }

  return {
    attempted: tokens.length,
    successCount: result.successCount,
    failureCount: result.failureCount,
    skippedNoToken,
  };
}
