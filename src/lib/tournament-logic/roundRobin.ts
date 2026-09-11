import { emptySets, type EntryDraft, type MatchDraft, type MatchStage } from "./types";

export function roundRobinMatches(
  entries: EntryDraft[],
  durationMinutes: number,
  groupId: string | null,
  stage: MatchStage = "group",
): MatchDraft[] {
  const matches: MatchDraft[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      matches.push({
        id: crypto.randomUUID(),
        groupId,
        stage,
        round: null,
        bracketSlot: null,
        court: null,
        scheduledTime: null,
        teamA: { entryId: entries[i].id, playerIds: entries[i].playerIds, name: entries[i].name },
        teamB: { entryId: entries[j].id, playerIds: entries[j].playerIds, name: entries[j].name },
        sets: emptySets(),
        completed: false,
        winnerSide: null,
        durationMinutes,
      });
    }
  }
  return matches;
}
