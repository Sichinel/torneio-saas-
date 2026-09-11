import { isByeMatch, type MatchDraft } from "./types";

export type CategoryTiers = { tiers: MatchDraft[][] };

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Minutos entre o início do torneio e `time` ("HH:MM" ou "HH:MM:SS"). */
export function minutesSinceStart(startTime: string, time: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return toMin(time) - toMin(startTime);
}

/**
 * Agenda um mata-mata recém-gerado. A 1ª rodada começa a partir de
 * `notBefore` (fim da fase de grupos); cada partida das rodadas seguintes
 * só começa depois das duas que a alimentam. Cada partida vai pra quadra
 * que fica livre mais cedo (`courtFreeFrom`: minutos desde o início em
 * que cada quadra termina o que já tinha agendado). Horários em minutos
 * desde `startTime`.
 */
export function scheduleKnockout(
  matches: MatchDraft[],
  courts: string[],
  startTime: string,
  courtFreeFrom: Record<string, number>,
  notBefore: number,
) {
  const courtFree: Record<string, number> = {};
  courts.forEach((c) => (courtFree[c] = Math.max(courtFreeFrom[c] ?? 0, 0)));
  const endOf = new Map<string, number>();
  const ordered = [...matches].sort((x, y) => (x.round ?? 0) - (y.round ?? 0) || (x.bracketSlot ?? 0) - (y.bracketSlot ?? 0));

  for (const match of ordered) {
    const round = match.round ?? 0;
    const slot = match.bracketSlot ?? 0;
    const feeders = ordered.filter((m) => m.round === round - 1 && (m.bracketSlot === slot * 2 || m.bracketSlot === slot * 2 + 1));
    const earliest = round === 0 ? notBefore : Math.max(notBefore, ...feeders.map((f) => endOf.get(f.id) ?? notBefore));

    let bestCourt = courts[0];
    courts.forEach((c) => {
      if (Math.max(courtFree[c], earliest) < Math.max(courtFree[bestCourt], earliest)) bestCourt = c;
    });
    const start = Math.max(courtFree[bestCourt], earliest);
    match.court = bestCourt;
    match.scheduledTime = addMinutes(startTime, start);
    courtFree[bestCourt] = start + match.durationMinutes;
    endOf.set(match.id, start + match.durationMinutes);
  }
}

function playersOf(match: MatchDraft): string[] {
  return [...(match.teamA?.playerIds ?? []), ...(match.teamB?.playerIds ?? [])];
}

/**
 * Agenda partidas de TODAS as categorias do torneio nas mesmas quadras,
 * "camada" por "camada" (grupos/mata-mata/americano-fixas têm 1 única
 * camada; americano rotativo e Super 8 têm 1 camada por rodada). Dentro
 * de cada camada, intercala as categorias (ordem de prioridade) — é isso
 * que garante que categorias em paralelo dividam as quadras de forma
 * razoável em vez de uma esgotar o dia da outra.
 *
 * Cada vez que uma quadra libera, ela recebe a primeira partida da fila
 * cujos jogadores estão todos livres naquele horário; se nenhuma estiver,
 * a quadra espera até o próximo jogador ficar livre. Assim ninguém é
 * escalado em duas quadras ao mesmo tempo (nem entre camadas).
 */
export function scheduleAcrossCategories(categories: CategoryTiers[], courts: string[], startTime: string) {
  const courtFreeMinutes: Record<string, number> = {};
  courts.forEach((c) => (courtFreeMinutes[c] = 0));
  const playerFreeMinutes = new Map<string, number>();
  const freeAt = (match: MatchDraft) => Math.max(0, ...playersOf(match).map((p) => playerFreeMinutes.get(p) ?? 0));
  const maxTiers = categories.reduce((max, c) => Math.max(max, c.tiers.length), 0);

  for (let tier = 0; tier < maxTiers; tier++) {
    const perCategory = categories.map((c) => (c.tiers[tier] ?? []).filter((m) => !isByeMatch(m)));
    const tierMatches: MatchDraft[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const list of perCategory) {
        const m = list.shift();
        if (m) {
          tierMatches.push(m);
          added = true;
        }
      }
    }

    while (tierMatches.length > 0) {
      let bestCourt = courts[0];
      courts.forEach((c) => {
        if (courtFreeMinutes[c] < courtFreeMinutes[bestCourt]) bestCourt = c;
      });
      const now = courtFreeMinutes[bestCourt];
      const idx = tierMatches.findIndex((m) => freeAt(m) <= now);
      if (idx === -1) {
        // ninguém da fila pode jogar agora: a quadra fica parada até o próximo jogador liberar
        courtFreeMinutes[bestCourt] = Math.min(...tierMatches.map(freeAt));
        continue;
      }
      const [match] = tierMatches.splice(idx, 1);
      match.court = bestCourt;
      match.scheduledTime = addMinutes(startTime, now);
      courtFreeMinutes[bestCourt] = now + match.durationMinutes;
      playersOf(match).forEach((p) => playerFreeMinutes.set(p, now + match.durationMinutes));
    }
  }
}
