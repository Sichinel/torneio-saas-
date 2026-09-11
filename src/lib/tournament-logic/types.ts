export type EntryDraft = {
  id: string;
  playerIds: string[]; // 1 (individual) ou 2 (dupla) ids de players
  name: string;
};

export type MatchTeam = {
  entryId?: string;
  playerIds: string[];
  name: string;
  bye?: boolean;
} | null;

export type MatchStage =
  | "group"
  | "bracket"
  | "americano_round"
  | "super8_round"
  | "super8_final_a"
  | "super8_final_b";

export type MatchDraft = {
  id: string;
  groupId: string | null;
  stage: MatchStage;
  round: number | null;
  bracketSlot: number | null;
  court: string | null;
  scheduledTime: string | null;
  teamA: MatchTeam;
  teamB: MatchTeam;
  sets: { a: number | null; b: number | null }[];
  completed: boolean;
  winnerSide: "A" | "B" | null;
  durationMinutes: number;
};

export type GroupDraft = { id: string; name: string };

export function emptySets(): { a: number | null; b: number | null }[] {
  return [
    { a: null, b: null },
    { a: null, b: null },
    { a: null, b: null },
  ];
}

export function isByeMatch(m: { teamA: MatchTeam; teamB: MatchTeam }): boolean {
  return !!(m.teamA?.bye || m.teamB?.bye);
}
