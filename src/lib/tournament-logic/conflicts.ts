import { formatTime } from "./display";
import type { MatchTeam } from "./types";

export type ScheduledMatch = {
  id: string;
  court: string | null;
  scheduledTime: string | null;
  durationMinutes: number;
  playerIds: string[];
  /** "Ana / Bia vs Carla / Duda" — usado no texto do aviso */
  label: string;
  completed: boolean;
};

/** Converte linhas de `matches` (qualquer categoria) pro formato da checagem; jogos com BYE ficam de fora. */
export function scheduledMatchesFromRows(
  rows: {
    id: string;
    category_id: string;
    court: string | null;
    scheduled_time: string | null;
    team_a: MatchTeam;
    team_b: MatchTeam;
    completed: boolean;
  }[],
  durationOf: (categoryId: string) => number,
): ScheduledMatch[] {
  return rows
    .filter((r) => !r.team_a?.bye && !r.team_b?.bye)
    .map((r) => ({
      id: r.id,
      court: r.court,
      scheduledTime: r.scheduled_time,
      durationMinutes: durationOf(r.category_id),
      playerIds: [...(r.team_a?.playerIds ?? []), ...(r.team_b?.playerIds ?? [])],
      label: `${r.team_a?.name ?? "A definir"} vs ${r.team_b?.name ?? "A definir"}`,
      completed: r.completed,
    }));
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Conflitos de agenda do torneio inteiro (todas as categorias dividem as
 * quadras). Dois jogos conflitam se os horários se sobrepõem (levando em
 * conta a duração) e (a) estão na mesma quadra ou (b) têm um jogador em
 * comum. Não bloqueia nada — só serve pra sinalizar na tela. Jogos já
 * finalizados dos dois lados não contam (o conflito ficou no passado).
 * Devolve, por id de jogo, as frases explicando com quem ele conflita.
 */
export function findScheduleConflicts(matches: ScheduledMatch[]): Map<string, string[]> {
  const timed = matches
    .filter((m) => m.scheduledTime)
    .map((m) => ({ ...m, start: toMinutes(m.scheduledTime!), end: toMinutes(m.scheduledTime!) + m.durationMinutes }));
  const result = new Map<string, string[]>();
  const add = (id: string, text: string) => result.set(id, [...(result.get(id) ?? []), text]);

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const x = timed[i];
      const y = timed[j];
      if (x.completed && y.completed) continue;
      if (!(x.start < y.end && y.start < x.end)) continue;

      if (x.court && x.court === y.court) {
        add(x.id, `${y.court} às ${formatTime(y.scheduledTime)} também tem: ${y.label}`);
        add(y.id, `${x.court} às ${formatTime(x.scheduledTime)} também tem: ${x.label}`);
        continue;
      }
      if (x.playerIds.some((p) => y.playerIds.includes(p))) {
        add(x.id, `Mesma dupla/jogador em outro jogo às ${formatTime(y.scheduledTime)} (${y.court ?? "sem quadra"}): ${y.label}`);
        add(y.id, `Mesma dupla/jogador em outro jogo às ${formatTime(x.scheduledTime)} (${x.court ?? "sem quadra"}): ${x.label}`);
      }
    }
  }
  return result;
}
