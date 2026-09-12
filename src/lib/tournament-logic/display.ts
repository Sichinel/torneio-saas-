import type { SetScore } from "./results";

export type MatchStatus = "pendente" | "andamento" | "finalizado";

/** "09:40:00" (coluna time do Postgres) → "09:40". */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "--:--";
}

/**
 * "2026-09-11" (coluna date do Postgres) → "sex, 11/09/2026".
 *
 * Sem `new Date(iso)`: "2026-09-11" sozinho é interpretado como meia-noite
 * UTC e, em fuso negativo, renderiza o dia anterior — o torneio se
 * anunciaria no dia errado.
 *
 * Mora aqui, e não junto do editor de data, porque a lista de torneios é
 * Server Component e o editor é `"use client"`: chamar uma função
 * exportada de um módulo cliente a partir do servidor derruba a página
 * inteira ("Attempted to call formatarData() from the server").
 */
export function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const d = new Date(ano, mes - 1, dia);
  const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

/** Sets jogados como "6-4 3-6 7-5" (vazio se nenhum). */
export function formatSets(sets: SetScore[] | null | undefined): string {
  return (sets ?? [])
    .filter((s) => s.a !== null && s.b !== null)
    .map((s) => `${s.a}-${s.b}`)
    .join("  ");
}

export function matchStatus(match: { completed: boolean; sets: SetScore[] | null | undefined }): MatchStatus {
  if (match.completed) return "finalizado";
  return (match.sets ?? []).some((s) => s.a !== null || s.b !== null) ? "andamento" : "pendente";
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  pendente: "Agendado",
  andamento: "Ao vivo",
  finalizado: "Finalizado",
};
