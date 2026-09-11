import { shuffle } from "./shuffle";
import { emptySets, type EntryDraft, type MatchDraft, type MatchStage } from "./types";

type RotWorker = { id: string; playerIds: string[]; name: string; bye: boolean };

/**
 * Rodízio de parceiros: a cada rodada os pares mudam (algoritmo clássico
 * de "fixa um, gira o resto"). Usado tanto pelo Americano rotativo quanto
 * por cada grupo do Super 8 — a única diferença é o `stage` e o `groupId`.
 */
export function generateRotatingRounds(
  players: EntryDraft[],
  rounds: number,
  durationMinutes: number,
  stage: MatchStage,
  groupId: string | null,
): MatchDraft[][] {
  const shuffled = shuffle(players);
  const working: RotWorker[] = shuffled.map((p) => ({ id: p.id, playerIds: p.playerIds, name: p.name, bye: false }));
  if (working.length % 2 !== 0) {
    working.push({ id: `bye-${crypto.randomUUID()}`, playerIds: [], name: "BYE", bye: true });
  }

  const n = working.length;
  let current = working;
  const allRounds: MatchDraft[][] = [];

  for (let r = 0; r < rounds; r++) {
    if (r > 0) {
      const fixed = current[0];
      const rest = current.slice(1);
      rest.unshift(rest.pop()!);
      current = [fixed, ...rest];
    }

    const pairs: [RotWorker, RotWorker][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([current[i], current[n - 1 - i]]);

    const roundMatches: MatchDraft[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      if (!pairs[i + 1]) continue;
      const [a1, a2] = pairs[i];
      const [b1, b2] = pairs[i + 1];
      roundMatches.push({
        id: crypto.randomUUID(),
        groupId,
        stage,
        round: r,
        bracketSlot: null,
        court: null,
        scheduledTime: null,
        teamA: {
          playerIds: [...a1.playerIds, ...a2.playerIds],
          name: `${a1.name} / ${a2.name}`,
          bye: a1.bye || a2.bye,
        },
        teamB: {
          playerIds: [...b1.playerIds, ...b2.playerIds],
          name: `${b1.name} / ${b2.name}`,
          bye: b1.bye || b2.bye,
        },
        sets: emptySets(),
        completed: false,
        winnerSide: null,
        durationMinutes,
      });
    }
    allRounds.push(roundMatches);
  }

  return allRounds;
}
