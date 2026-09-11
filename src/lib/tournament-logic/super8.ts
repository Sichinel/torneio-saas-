import { shuffle } from "./shuffle";
import { generateRotatingRounds } from "./americano";
import { emptySets, type EntryDraft, type GroupDraft, type MatchDraft } from "./types";

/**
 * Distribui os jogadores em grupos de até 8 (não "1 grupo de 8 + sobra
 * pequena" — divide o mais equilibrado possível).
 */
export function distributeSuper8Groups(entries: EntryDraft[]): { group: GroupDraft; members: EntryDraft[] }[] {
  const numGroups = Math.max(1, Math.round(entries.length / 8));
  const shuffled = shuffle(entries);
  const groups: GroupDraft[] = Array.from({ length: numGroups }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Grupo ${String.fromCharCode(65 + i)}`,
  }));
  const members: EntryDraft[][] = Array.from({ length: numGroups }, () => []);
  shuffled.forEach((e, i) => members[i % numGroups].push(e));
  return groups.map((group, i) => ({ group, members: members[i] }));
}

export function generateSuper8GroupRounds(members: EntryDraft[], groupId: string, durationMinutes: number): MatchDraft[][] {
  const rounds = Math.max(3, members.length - 1);
  return generateRotatingRounds(members, rounds, durationMinutes, "super8_round", groupId);
}

export type Super8StandingRow = { entry: EntryDraft; points: number };

/**
 * Duplas novas por classificação: Top 4 -> Final A (1º+4º vs 2º+3º);
 * últimos 4 -> Final B (5º+8º vs 6º+7º). Com grupo menor (>=4, <8), só
 * gera a Final A com os 4 primeiros. Chamado depois que a fase de grupo
 * termina (passo 9) — a lógica em si não depende de banco de dados.
 */
export function generateSuper8Finals(
  standingsDesc: Super8StandingRow[],
  groupId: string,
  durationMinutes: number,
): MatchDraft[] {
  const matches: MatchDraft[] = [];

  function makeFinal(stage: "super8_final_a" | "super8_final_b", four: EntryDraft[]) {
    const [p1, p2, p3, p4] = four;
    matches.push({
      id: crypto.randomUUID(),
      groupId,
      stage,
      round: 0,
      bracketSlot: null,
      court: null,
      scheduledTime: null,
      teamA: { playerIds: [...p1.playerIds, ...p4.playerIds], name: `${p1.name} / ${p4.name}` },
      teamB: { playerIds: [...p2.playerIds, ...p3.playerIds], name: `${p2.name} / ${p3.name}` },
      sets: emptySets(),
      completed: false,
      winnerSide: null,
      durationMinutes,
    });
  }

  if (standingsDesc.length >= 8) {
    makeFinal("super8_final_a", standingsDesc.slice(0, 4).map((r) => r.entry));
    makeFinal("super8_final_b", standingsDesc.slice(4, 8).map((r) => r.entry));
  } else if (standingsDesc.length >= 4) {
    makeFinal("super8_final_a", standingsDesc.slice(0, 4).map((r) => r.entry));
  }

  return matches;
}
