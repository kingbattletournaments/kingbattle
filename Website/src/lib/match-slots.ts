export type MatchType = "solo" | "duo" | "squad";

export function teamSizeFor(matchType: MatchType | string | undefined): number {
  switch (matchType) {
    case "duo":
      return 2;
    case "squad":
      return 4;
    default:
      return 1;
  }
}

export function validateMaxParticipants(
  matchType: MatchType | string | undefined,
  maxParticipants: number,
): string | null {
  if (!Number.isFinite(maxParticipants) || maxParticipants < 1) {
    return "Max participants must be at least 1";
  }
  const teamSize = teamSizeFor(matchType);
  if (teamSize > 1 && maxParticipants % teamSize !== 0) {
    if (matchType === "duo") {
      return "Duo matches require max participants divisible by 2 (each team has 2 slots)";
    }
    if (matchType === "squad") {
      return "Squad matches require max participants divisible by 4 (each team has 4 slots)";
    }
  }
  return null;
}

export function normalizeMaxParticipants(
  matchType: MatchType | string | undefined,
  maxParticipants: number,
): number {
  const err = validateMaxParticipants(matchType, maxParticipants);
  if (err) {
    const teamSize = teamSizeFor(matchType);
    if (teamSize > 1) {
      return Math.max(teamSize, Math.floor(maxParticipants / teamSize) * teamSize);
    }
  }
  return maxParticipants;
}

export function teamCount(maxParticipants: number, matchType: MatchType | string | undefined): number {
  const ts = teamSizeFor(matchType);
  return Math.floor(maxParticipants / ts);
}

export function slotToTeamNumber(slotIndex: number, matchType: MatchType | string | undefined): number {
  const ts = teamSizeFor(matchType);
  return Math.ceil(slotIndex / ts);
}

export function slotPositionInTeam(slotIndex: number, matchType: MatchType | string | undefined): number {
  const ts = teamSizeFor(matchType);
  return ((slotIndex - 1) % ts) + 1;
}

export function teamSlotIndices(
  teamNumber: number,
  matchType: MatchType | string | undefined,
  maxParticipants: number,
): number[] {
  const ts = teamSizeFor(matchType);
  const start = (teamNumber - 1) * ts + 1;
  return Array.from({ length: ts }, (_, i) => start + i).filter((s) => s <= maxParticipants);
}

export function validateSlotSelection(
  slotIndices: number[],
  matchType: MatchType | string | undefined,
  maxParticipants: number,
): string | null {
  if (slotIndices.length === 0) return "Select at least one slot";
  const teamSize = teamSizeFor(matchType);
  if (slotIndices.length > teamSize) {
    return `You can select at most ${teamSize} slot${teamSize === 1 ? "" : "s"}`;
  }
  const unique = new Set(slotIndices);
  if (unique.size !== slotIndices.length) return "Duplicate slots selected";
  for (const s of slotIndices) {
    if (!Number.isInteger(s) || s < 1 || s > maxParticipants) return "Invalid slot number";
  }
  if (teamSize > 1) {
    const teams = new Set(slotIndices.map((s) => slotToTeamNumber(s, matchType)));
    if (teams.size !== 1) return "All selected slots must be from the same team";
  }
  return null;
}

export type SlotAvailabilityStatus = "available" | "held" | "confirmed";

export type SlotAvailability = {
  slotIndex: number;
  teamNumber: number;
  positionInTeam: number;
  status: SlotAvailabilityStatus;
  heldByMe: boolean;
};

export function buildSlotGrid(
  maxParticipants: number,
  matchType: MatchType | string | undefined,
  bookings: {
    slot_index: number;
    app_user_id: string;
    status: string;
  }[],
  currentUserId?: string,
): SlotAvailability[] {
  const bookingMap = new Map<number, { status: SlotAvailabilityStatus; heldByMe: boolean }>();
  for (const b of bookings) {
    const status: SlotAvailabilityStatus =
      b.status === "confirmed" ? "confirmed" : b.status === "held" ? "held" : "available";
    bookingMap.set(b.slot_index, {
      status,
      heldByMe: !!currentUserId && b.app_user_id === currentUserId && status === "held",
    });
  }
  const slots: SlotAvailability[] = [];
  for (let i = 1; i <= maxParticipants; i++) {
    const booked = bookingMap.get(i);
    slots.push({
      slotIndex: i,
      teamNumber: slotToTeamNumber(i, matchType),
      positionInTeam: slotPositionInTeam(i, matchType),
      status: booked?.status ?? "available",
      heldByMe: booked?.heldByMe ?? false,
    });
  }
  return slots;
}
