import { roundRobinMatches } from "./roundRobin";
import { generateBracket } from "./bracket";
import { generateRotatingRounds } from "./americano";
import { distributeSuper8Groups, generateSuper8GroupRounds } from "./super8";
import type { EntryDraft, GroupDraft, MatchDraft } from "./types";
import type { CategoryDraft } from "@/lib/wizard/types";

export type BuiltCategory = {
  groups: GroupDraft[];
  groupEntries: { groupId: string; entryId: string }[];
  matches: MatchDraft[];
  tiers: MatchDraft[][];
};

export function buildCategory(draft: CategoryDraft, entries: EntryDraft[]): BuiltCategory {
  const duration = draft.durationMinutes;

  if (draft.format === "grupos") {
    const ng = Math.max(1, Math.min(draft.numGroups, entries.length));
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const groups: GroupDraft[] = Array.from({ length: ng }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Grupo ${String.fromCharCode(65 + i)}`,
    }));
    const buckets: EntryDraft[][] = Array.from({ length: ng }, () => []);
    const groupEntries: { groupId: string; entryId: string }[] = [];
    shuffled.forEach((e, i) => {
      const gi = i % ng;
      buckets[gi].push(e);
      groupEntries.push({ groupId: groups[gi].id, entryId: e.id });
    });
    const matches = buckets.flatMap((members, i) => roundRobinMatches(members, duration, groups[i].id, "group"));
    return { groups, groupEntries, matches, tiers: [matches] };
  }

  if (draft.format === "mata") {
    const matches = generateBracket(entries, duration, draft.setsToWin);
    const round0 = matches.filter((m) => m.round === 0);
    return { groups: [], groupEntries: [], matches, tiers: [round0] };
  }

  if (draft.format === "americano" && draft.americanoType === "rotativo") {
    const rounds = generateRotatingRounds(entries, draft.rounds, duration, "americano_round", null);
    return { groups: [], groupEntries: [], matches: rounds.flat(), tiers: rounds };
  }

  if (draft.format === "americano" && draft.americanoType === "fixas") {
    const matches = roundRobinMatches(entries, duration, null, "group");
    return { groups: [], groupEntries: [], matches, tiers: [matches] };
  }

  // super8
  const groupsWithMembers = distributeSuper8Groups(entries);
  const groups = groupsWithMembers.map((g) => g.group);
  const groupEntries = groupsWithMembers.flatMap(({ group, members }) =>
    members.map((m) => ({ groupId: group.id, entryId: m.id })),
  );
  const perGroupRounds = groupsWithMembers.map(({ group, members }) => generateSuper8GroupRounds(members, group.id, duration));
  const maxRounds = perGroupRounds.reduce((max, r) => Math.max(max, r.length), 0);
  const tiers: MatchDraft[][] = [];
  for (let t = 0; t < maxRounds; t++) {
    tiers.push(perGroupRounds.flatMap((rounds) => rounds[t] ?? []));
  }
  return { groups, groupEntries, matches: tiers.flat(), tiers };
}
