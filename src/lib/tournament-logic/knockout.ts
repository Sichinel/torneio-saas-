import { emptySets, type MatchDraft, type MatchTeam } from "./types";
import { computeGroupStandings } from "./standings";
import { hasAnyScore, winnerTeam, type SetScore } from "./results";

export const QUALIFIERS_PER_GROUP = 2;

/** Nome da rodada contando do fim: a última é a Final. */
export function knockoutRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - round;
  return ["Final", "Semifinal", "Quartas de final", "Oitavas de final"][fromEnd] ?? `Rodada ${round + 1}`;
}

type GroupStageMatch = {
  groupId: string | null;
  teamA: MatchTeam;
  teamB: MatchTeam;
  sets: SetScore[];
  completed: boolean;
  winnerSide: "A" | "B" | null;
};

const isPow2 = (n: number) => n >= 2 && (n & (n - 1)) === 0;
const stripTeam = (t: NonNullable<MatchTeam>): NonNullable<MatchTeam> => ({ entryId: t.entryId, playerIds: t.playerIds, name: t.name });

/**
 * Monta os confrontos da 1ª rodada do mata-mata a partir da classificação
 * dos grupos (grupos em ordem de nome). Com 2 classificados, os grupos
 * viram pares (A,B), (C,D)…: 1ºA×2ºB e 1ºC×2ºD na metade de cima da
 * chave, 1ºB×2ºA e 1ºD×2ºC na de baixo — duplas do mesmo grupo só podem
 * se reencontrar na final. Com 1 classificado: 1ºA×1ºB, 1ºC×1ºD…
 */
export function crossGroupsFirstRound(
  groups: { id: string; name: string }[],
  matches: GroupStageMatch[],
  qualifiers: number,
): { ok: true; pairs: [NonNullable<MatchTeam>, NonNullable<MatchTeam>][] } | { ok: false; error: string } {
  const ordered = [...groups].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (ordered.length % 2 !== 0) return { ok: false, error: "O cruzamento precisa de um número par de grupos." };
  if (!isPow2(ordered.length * qualifiers)) {
    return { ok: false, error: `${ordered.length * qualifiers} classificados não formam uma chave (precisa ser 2, 4, 8, 16…).` };
  }

  const ranked: NonNullable<MatchTeam>[][] = [];
  for (const g of ordered) {
    const groupMatches = matches.filter((m) => m.groupId === g.id);
    const teamById = new Map<string, NonNullable<MatchTeam>>();
    groupMatches.forEach((m) => {
      [m.teamA, m.teamB].forEach((t) => t && !t.bye && teamById.set(t.entryId ?? t.name, t));
    });
    const standings = computeGroupStandings(groupMatches);
    if (standings.length < qualifiers) return { ok: false, error: `O ${g.name} tem menos de ${qualifiers} duplas.` };
    ranked.push(standings.slice(0, qualifiers).map((s) => stripTeam(teamById.get(s.entryId)!)));
  }

  const top: [NonNullable<MatchTeam>, NonNullable<MatchTeam>][] = [];
  const bottom: [NonNullable<MatchTeam>, NonNullable<MatchTeam>][] = [];
  for (let i = 0; i < ranked.length; i += 2) {
    const [x, y] = [ranked[i], ranked[i + 1]];
    if (qualifiers === 1) {
      top.push([x[0], y[0]]);
    } else {
      top.push([x[0], y[1]]);
      bottom.push([y[0], x[1]]);
    }
  }
  return { ok: true, pairs: [...top, ...bottom] };
}

/** Chave completa a partir dos confrontos da 1ª rodada (sem BYE): rodadas seguintes nascem vazias. */
export function buildKnockoutMatches(
  pairs: [NonNullable<MatchTeam>, NonNullable<MatchTeam>][],
  durationMinutes: number,
): MatchDraft[] {
  const matches: MatchDraft[] = [];
  const base = (round: number, slot: number): MatchDraft => ({
    id: crypto.randomUUID(),
    groupId: null,
    stage: "bracket",
    round,
    bracketSlot: slot,
    court: null,
    scheduledTime: null,
    teamA: null,
    teamB: null,
    sets: emptySets(),
    completed: false,
    winnerSide: null,
    durationMinutes,
  });
  pairs.forEach(([a, b], slot) => matches.push({ ...base(0, slot), teamA: a, teamB: b }));
  for (let round = 1, count = pairs.length / 2; count >= 1; round++, count /= 2) {
    for (let slot = 0; slot < count; slot++) matches.push(base(round, slot));
  }
  return matches;
}

export function isGroupStageComplete(matches: { stage: string; completed: boolean }[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === "group");
  return groupMatches.length > 0 && groupMatches.every((m) => m.completed);
}

type BracketMatch = {
  id: string;
  round: number | null;
  bracketSlot: number | null;
  teamA: MatchTeam;
  teamB: MatchTeam;
  sets: SetScore[];
  winnerSide: "A" | "B" | null;
};

/**
 * O que muda na partida seguinte da chave quando o resultado de `match`
 * muda (vencedor novo, trocado ou apagado). Devolve null se nada muda
 * (final, ou mesmo vencedor). Recusa se a partida seguinte já tem placar:
 * trocar quem joga nela invalidaria um resultado já lançado.
 */
export function planBracketAdvance(
  match: BracketMatch,
  bracket: BracketMatch[],
): { ok: true; change: { nextId: string; side: "teamA" | "teamB"; team: MatchTeam } | null } | { ok: false; error: string } {
  if (match.round === null || match.bracketSlot === null) return { ok: true, change: null };
  const next = bracket.find((m) => m.round === match.round! + 1 && m.bracketSlot === Math.floor(match.bracketSlot! / 2));
  if (!next) return { ok: true, change: null };

  const side = match.bracketSlot % 2 === 0 ? "teamA" : "teamB";
  const winner = winnerTeam(match);
  const team = winner ? stripTeam(winner) : null;
  const current = next[side];
  const sameTeam = (current?.entryId ?? null) === (team?.entryId ?? null) && (current?.name ?? null) === (team?.name ?? null);
  if (sameTeam) return { ok: true, change: null };
  if (hasAnyScore(next.sets)) {
    return { ok: false, error: "A partida seguinte da chave já tem placar. Limpe o placar dela antes de mudar este resultado." };
  }
  return { ok: true, change: { nextId: next.id, side, team } };
}
