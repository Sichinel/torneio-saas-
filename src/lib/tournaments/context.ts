import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import type { SetScore } from "@/lib/tournament-logic/results";

// Helpers compartilhados pelas Server Actions de torneio. Este arquivo NÃO
// é "use server" de propósito: funções exportadas de um arquivo "use
// server" viram endpoints públicos, e estas só devem rodar dentro de uma
// action que já as chama.

export const MATCH_COLUMNS =
  "id, category_id, group_id, stage, round, bracket_slot, court, scheduled_time, team_a, team_b, sets, completed, winner_side";

export type MatchRow = {
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

export type TournamentContext = {
  supabase: SupabaseClient;
  userId: string;
  category: { id: string; format: string; sets_to_win: number; max_sets: number; config: Record<string, unknown> | null };
  tournament: { id: string; public_code: string; courts: string[]; start_time: string };
};

/** Usuário logado + categoria + torneio, garantindo que o usuário é o organizador. */
export async function loadCategoryContext(
  categoryId: string,
): Promise<{ ok: true; ctx: TournamentContext } | { ok: false; error: string }> {
  if (typeof categoryId !== "string" || !categoryId) return { ok: false, error: "Categoria inválida." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Atualize a página e faça login de novo." };

  const { data: category } = await supabase
    .from("categories")
    .select("id, format, sets_to_win, max_sets, config, tournament_id")
    .eq("id", categoryId)
    .maybeSingle();
  const { data: tournament } = category
    ? await supabase
        .from("tournaments")
        .select("id, organizer_id, public_code, courts, start_time")
        .eq("id", category.tournament_id)
        .maybeSingle()
    : { data: null };
  if (!category || !tournament || tournament.organizer_id !== user.id) {
    return { ok: false, error: "Não encontrado (ou você não é o organizador deste torneio)." };
  }
  return { ok: true, ctx: { supabase, userId: user.id, category, tournament } };
}

export function revalidateTournament(t: TournamentContext["tournament"]) {
  revalidatePath(`/dashboard/${t.id}`);
  revalidatePath(`/t/${t.public_code}`);
}

