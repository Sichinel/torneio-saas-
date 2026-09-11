import type { MatchTeam } from "./types";

export type SetScore = { a: number | null; b: number | null };

export type ResultCheck =
  | { ok: true; sets: SetScore[]; winnerSide: "A" | "B" | null; completed: boolean }
  | { ok: false; error: string };

const MAX_GAMES = 99;

/**
 * Valida o placar digitado pelo organizador e decide o vencedor.
 * Aceita placar parcial (jogo em andamento: sets lançados até agora) —
 * é o que a página pública mostra "ao vivo". Sempre devolve 3 sets
 * (formato gravado em matches.sets), com os não jogados como null.
 *
 * Regras: um set é os dois lados preenchidos ou os dois vazios; set
 * jogado não empata; sets em ordem (não pula o 1º pra lançar o 2º);
 * nada depois de o jogo estar decidido; categoria de 1 set só usa o 1º.
 */
export function checkResult(raw: SetScore[], setsToWin: number, maxSets: number): ResultCheck {
  const sets: SetScore[] = [0, 1, 2].map((i) => ({ a: raw[i]?.a ?? null, b: raw[i]?.b ?? null }));

  let aSets = 0;
  let bSets = 0;
  let winnerSide: "A" | "B" | null = null;
  let sawEmpty = false;

  for (let i = 0; i < sets.length; i++) {
    const { a, b } = sets[i];
    const n = i + 1;
    if (a === null && b === null) {
      sawEmpty = true;
      continue;
    }
    if (a === null || b === null) return { ok: false, error: `Preencha os dois lados do ${n}º set.` };
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > MAX_GAMES || b > MAX_GAMES) {
      return { ok: false, error: `O ${n}º set tem um número inválido.` };
    }
    if (i >= maxSets) return { ok: false, error: "Essa categoria é decidida em 1 set só." };
    if (sawEmpty) return { ok: false, error: `Lance o ${n - 1}º set antes do ${n}º.` };
    if (winnerSide) return { ok: false, error: `O jogo já estava decidido antes do ${n}º set.` };
    if (a === b) return { ok: false, error: `O ${n}º set não pode terminar empatado.` };

    if (a > b) aSets++;
    else bSets++;
    if (aSets >= setsToWin) winnerSide = "A";
    else if (bSets >= setsToWin) winnerSide = "B";
  }

  return { ok: true, sets, winnerSide, completed: winnerSide !== null };
}

export function hasAnyScore(sets: SetScore[] | null | undefined): boolean {
  return (sets ?? []).some((s) => s.a !== null || s.b !== null);
}

export function winnerTeam(match: { teamA: MatchTeam; teamB: MatchTeam; winnerSide: "A" | "B" | null }): MatchTeam {
  if (match.winnerSide === "A") return match.teamA;
  if (match.winnerSide === "B") return match.teamB;
  return null;
}
