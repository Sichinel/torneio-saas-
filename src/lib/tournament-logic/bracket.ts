import { shuffle } from "./shuffle";
import { decideWinner } from "./scoring";
import { emptySets, type EntryDraft, type MatchDraft, type MatchTeam } from "./types";

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function toTeam(x: EntryDraft | { bye: true; id: string; name: string }): MatchTeam {
  if ("bye" in x) return { playerIds: [], name: "BYE", bye: true };
  return { entryId: x.id, playerIds: x.playerIds, name: x.name };
}

/**
 * Gera o chaveamento completo (todas as rodadas, com BYEs propagados).
 * Só a rodada 0 tem times reais desde já — o resto é preenchido conforme
 * os jogos anteriores terminam (fora deste módulo, no passo 9).
 */
export function generateBracket(entries: EntryDraft[], durationMinutes: number, setsToWin: number): MatchDraft[] {
  const shuffled = shuffle(entries);
  const size = nextPow2(Math.max(shuffled.length, 2));
  const padded: (EntryDraft | { bye: true; id: string; name: string })[] = [...shuffled];
  while (padded.length < size) padded.push({ bye: true, id: `bye-${crypto.randomUUID()}`, name: "BYE" });

  const round0: MatchDraft[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    round0.push({
      id: crypto.randomUUID(),
      groupId: null,
      stage: "bracket",
      round: 0,
      bracketSlot: round0.length,
      court: null,
      scheduledTime: null,
      teamA: toTeam(padded[i]),
      teamB: toTeam(padded[i + 1]),
      sets: emptySets(),
      completed: false,
      winnerSide: null,
      durationMinutes,
    });
  }

  const rounds: MatchDraft[][] = [round0];
  let count = round0.length / 2;
  let r = 1;
  while (count >= 1) {
    const round: MatchDraft[] = [];
    for (let i = 0; i < count; i++) {
      round.push({
        id: crypto.randomUUID(),
        groupId: null,
        stage: "bracket",
        round: r,
        bracketSlot: i,
        court: null,
        scheduledTime: null,
        teamA: null,
        teamB: null,
        sets: emptySets(),
        completed: false,
        winnerSide: null,
        durationMinutes,
      });
    }
    rounds.push(round);
    count /= 2;
    r++;
  }

  propagateAllByes(rounds, setsToWin);
  return rounds.flat();
}

function propagateAllByes(rounds: MatchDraft[][], setsToWin: number) {
  for (let r = 0; r < rounds.length; r++) {
    rounds[r].forEach((match, idx) => {
      const w = decideWinner(match.sets, setsToWin, match.teamA, match.teamB);
      if (w && (match.teamA?.bye || match.teamB?.bye)) {
        match.completed = true;
        match.winnerSide = w;
        advanceWinner(rounds, r, idx, setsToWin);
      }
    });
  }
}

function advanceWinner(rounds: MatchDraft[][], r: number, idx: number, setsToWin: number) {
  if (r + 1 >= rounds.length) return;
  const match = rounds[r][idx];
  const winner = match.winnerSide === "A" ? match.teamA : match.teamB;
  if (!winner) return;

  const nextIdx = Math.floor(idx / 2);
  const slot = idx % 2 === 0 ? "teamA" : "teamB";
  const nextMatch = rounds[r + 1][nextIdx];
  nextMatch[slot] = { entryId: winner.entryId, playerIds: winner.playerIds, name: winner.name };

  const w2 = decideWinner(nextMatch.sets, setsToWin, nextMatch.teamA, nextMatch.teamB);
  if (w2 && (nextMatch.teamA?.bye || nextMatch.teamB?.bye)) {
    nextMatch.completed = true;
    nextMatch.winnerSide = w2;
    advanceWinner(rounds, r + 1, nextIdx, setsToWin);
  }
}
