import type { MatchTeam } from "./types";

/**
 * Decide o vencedor a partir dos sets já lançados. setsToWin vem da
 * categoria (1 = "1 set decide", 2 = "melhor de 3") — nunca fixo em 2
 * como no protótipo original.
 */
export function decideWinner(
  sets: { a: number | null; b: number | null }[],
  setsToWin: number,
  teamA: MatchTeam,
  teamB: MatchTeam,
): "A" | "B" | null {
  if (!teamA || !teamB) return null;
  if (teamA.bye) return "B";
  if (teamB.bye) return "A";

  let aSets = 0;
  let bSets = 0;
  for (const s of sets) {
    if (s.a !== null && s.b !== null && Number(s.a) !== Number(s.b)) {
      if (Number(s.a) > Number(s.b)) aSets++;
      else bSets++;
    }
  }
  if (aSets >= setsToWin) return "A";
  if (bSets >= setsToWin) return "B";
  return null;
}
