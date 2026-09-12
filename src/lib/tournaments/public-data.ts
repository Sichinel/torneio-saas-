import type { MatchTeam } from "@/lib/tournament-logic/types";
import type { SetScore } from "@/lib/tournament-logic/results";

/**
 * Contrato de dados da página pública /t/[code], compartilhado entre o
 * server component (carga inicial) e o cliente (refetch do Realtime).
 *
 * Mora aqui, e não no componente, porque um módulo "use client" não pode
 * exportar valor de runtime pro servidor: o Next entrega uma referência
 * de cliente no lugar da string, e o supabase-js quebra ao chamar
 * .split() nela.
 */
export const MATCH_COLUMNS =
  "id, category_id, group_id, stage, round, bracket_slot, court, scheduled_time, team_a, team_b, sets, completed, winner_side";

export type PublicMatch = {
  id: string;
  category_id: string;
  group_id: string | null;
  stage: string;
  round: number | null;
  bracket_slot: number | null;
  court: string | null;
  scheduled_time: string | null;
  team_a: MatchTeam;
  team_b: MatchTeam;
  sets: SetScore[];
  completed: boolean;
  winner_side: "A" | "B" | null;
};

export type PublicCategory = { id: string; name: string; format: string };
export type PublicGroup = { id: string; category_id: string; name: string };
export type PublicTournament = {
  id: string;
  name: string;
  courts: string[];
  start_time: string | null;
  event_date: string | null;
};
