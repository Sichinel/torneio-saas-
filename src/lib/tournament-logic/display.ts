import type { SetScore } from "./results";

export type MatchStatus = "pendente" | "andamento" | "finalizado";

/** "09:40:00" (coluna time do Postgres) → "09:40". */
export function formatTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : "--:--";
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
