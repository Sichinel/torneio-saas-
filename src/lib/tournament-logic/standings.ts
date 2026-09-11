import type { MatchTeam } from "./types";
import type { SetScore } from "./results";

export type StandingRow = {
  entryId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

type GroupMatch = {
  teamA: MatchTeam;
  teamB: MatchTeam;
  sets: SetScore[];
  completed: boolean;
  winnerSide: "A" | "B" | null;
};

/**
 * Classificação de um grupo a partir das partidas dele. Só partidas
 * finalizadas contam. Ordem: vitórias → saldo de sets → saldo de games →
 * confronto direto (só quando exatamente duas duplas seguem empatadas)
 * → nome, pra ordem ser estável.
 */
export function computeGroupStandings(matches: GroupMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const row = (team: NonNullable<MatchTeam>) => {
    const id = team.entryId ?? team.name;
    if (!rows.has(id)) {
      rows.set(id, { entryId: id, name: team.name, played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 });
    }
    return rows.get(id)!;
  };

  // todos os times do grupo aparecem, mesmo sem jogo finalizado
  matches.forEach((m) => {
    if (m.teamA && !m.teamA.bye) row(m.teamA);
    if (m.teamB && !m.teamB.bye) row(m.teamB);
  });

  const headToHead = new Map<string, string>(); // "idA|idB" -> id do vencedor
  matches.forEach((m) => {
    if (!m.completed || !m.teamA || !m.teamB || m.teamA.bye || m.teamB.bye) return;
    const a = row(m.teamA);
    const b = row(m.teamB);
    a.played++;
    b.played++;
    (m.winnerSide === "A" ? a : b).wins++;
    (m.winnerSide === "A" ? b : a).losses++;
    m.sets.forEach((s) => {
      if (s.a === null || s.b === null) return;
      a.gamesWon += s.a;
      a.gamesLost += s.b;
      b.gamesWon += s.b;
      b.gamesLost += s.a;
      if (s.a > s.b) {
        a.setsWon++;
        b.setsLost++;
      } else if (s.b > s.a) {
        b.setsWon++;
        a.setsLost++;
      }
    });
    const winner = m.winnerSide === "A" ? a.entryId : b.entryId;
    headToHead.set(`${a.entryId}|${b.entryId}`, winner);
    headToHead.set(`${b.entryId}|${a.entryId}`, winner);
  });

  const key = (r: StandingRow) => [r.wins, r.setsWon - r.setsLost, r.gamesWon - r.gamesLost];
  const sameKey = (x: StandingRow, y: StandingRow) => key(x).every((v, i) => v === key(y)[i]);

  const sorted = [...rows.values()].sort((x, y) => {
    const kx = key(x);
    const ky = key(y);
    for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
    return x.name.localeCompare(y.name, "pt-BR");
  });

  // confronto direto: aplica só em empates de exatamente 2 duplas
  for (let i = 0; i < sorted.length - 1; i++) {
    const tiedGroup = sorted.filter((r) => sameKey(r, sorted[i]));
    if (tiedGroup.length !== 2 || tiedGroup[0] !== sorted[i]) continue;
    const winner = headToHead.get(`${sorted[i].entryId}|${sorted[i + 1].entryId}`);
    if (winner === sorted[i + 1].entryId) [sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]];
  }

  return sorted;
}
