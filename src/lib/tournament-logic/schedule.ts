import { isByeMatch, type MatchDraft } from "./types";

export type CategoryTiers = { tiers: MatchDraft[][] };

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Agenda partidas de TODAS as categorias do torneio nas mesmas quadras,
 * "camada" por "camada" (grupos/mata-mata/americano-fixas têm 1 única
 * camada; americano rotativo e Super 8 têm 1 camada por rodada). Dentro
 * de cada camada, intercala as categorias e distribui pra quadra mais
 * livre — é isso que garante que categorias em paralelo dividam as
 * quadras de forma razoável em vez de uma esgotar o dia da outra.
 */
export function scheduleAcrossCategories(categories: CategoryTiers[], courts: string[], startTime: string) {
  const courtFreeMinutes: Record<string, number> = {};
  courts.forEach((c) => (courtFreeMinutes[c] = 0));
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

    tierMatches.forEach((match) => {
      let bestCourt = courts[0];
      courts.forEach((c) => {
        if (courtFreeMinutes[c] < courtFreeMinutes[bestCourt]) bestCourt = c;
      });
      match.court = bestCourt;
      match.scheduledTime = addMinutes(startTime, courtFreeMinutes[bestCourt]);
      courtFreeMinutes[bestCourt] += match.durationMinutes;
    });
  }
}
