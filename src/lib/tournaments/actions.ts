"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail, type ActionResult } from "@/lib/actions/result";
import { buildEntriesForCategory } from "./build-entries";
import { toPlayerBank } from "./resolve-entries";
import { buildCategory } from "@/lib/tournament-logic/build-category";
import { scheduleAcrossCategories, type CategoryTiers } from "@/lib/tournament-logic/schedule";
import { effectiveTeamType, type CategoryDraft } from "@/lib/wizard/types";
import type { MatchDraft } from "@/lib/tournament-logic/types";

export type CreateTournamentInput = {
  name: string;
  numCourts: number;
  startTime: string;
  categories: CategoryDraft[];
};

export type CreateTournamentResult = ActionResult & { code?: string };

function genPublicCode(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export async function createTournament(input: CreateTournamentInput): Promise<CreateTournamentResult> {
  if (!input.name.trim()) return fail("Dá um nome pro torneio.");
  if (input.categories.length === 0) return fail("Adicione pelo menos uma categoria.");

  for (const cat of input.categories) {
    const lineCount = cat.participantsRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean).length;
    if (lineCount < 2)
      return fail(`A categoria "${cat.name}" precisa de pelo menos 2 linhas preenchidas (jogadores ou duplas).`);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("createTournament: no authenticated user", authError);
    return fail("Sessão expirada. Atualize a página e faça login de novo.");
  }

  const { data: existingPlayers, error: playersError } = await supabase
    .from("players")
    .select("id, name, side")
    .eq("owner_id", user.id);
  if (playersError) {
    console.error("createTournament: failed to load player bank", playersError);
    return fail(`Não foi possível ler seu banco de jogadores: ${playersError.message}`);
  }
  // compartilhado entre as categorias: quem uma categoria cria, a próxima já enxerga
  const playerBank = toPlayerBank(existingPlayers ?? []);

  const courts = Array.from({ length: input.numCourts }, (_, i) => `Quadra ${i + 1}`);
  const publicCode = genPublicCode();

  const { data: tournamentRow, error: tournamentError } = await supabase
    .from("tournaments")
    .insert({ organizer_id: user.id, name: input.name.trim(), public_code: publicCode, courts, start_time: input.startTime })
    .select("id, public_code")
    .single();
  if (tournamentError || !tournamentRow) {
    console.error("createTournament: insert tournament failed", tournamentError);
    return fail(`Não foi possível criar o torneio: ${tournamentError?.message ?? "erro desconhecido"}`);
  }

  try {
    type CategoryBuild = {
      categoryId: string;
      entries: Awaited<ReturnType<typeof buildEntriesForCategory>>;
      built: ReturnType<typeof buildCategory>;
    };
    const categoryBuilds: CategoryBuild[] = [];
    const categoryTiers: CategoryTiers[] = [];

    for (const cat of input.categories) {
      const { data: categoryRow, error: categoryError } = await supabase
        .from("categories")
        .insert({
          tournament_id: tournamentRow.id,
          name: cat.name?.trim() || "Categoria",
          format: cat.format,
          team_type: effectiveTeamType(cat),
          americano_type: cat.format === "americano" ? cat.americanoType : null,
          sets_to_win: cat.setsToWin,
          max_sets: cat.setsToWin === 1 ? 1 : 3,
          config: { numGroups: cat.numGroups, rounds: cat.rounds, durationMinutes: cat.durationMinutes },
        })
        .select("id")
        .single();
      if (categoryError || !categoryRow) {
        throw new Error(categoryError?.message ?? "Falha ao criar categoria.");
      }

      const entries = await buildEntriesForCategory(supabase, user.id, cat, playerBank);
      if (entries.length < 2) {
        throw new Error(
          `A categoria "${cat.name}" ficou com menos de 2 participantes depois de resolver os jogadores. Confira se os nomes colados batem com o formato esperado.`,
        );
      }

      const built = buildCategory(cat, entries);
      categoryBuilds.push({ categoryId: categoryRow.id, entries, built });
      categoryTiers.push({ tiers: built.tiers });
    }

    // Agenda quadra/horário de TODAS as categorias juntas. Isso muta os
    // mesmos objetos de match referenciados dentro de `built` (tiers e
    // matches compartilham as instâncias, não cópias) — por isso a
    // montagem das linhas pro insert só acontece DEPOIS desta chamada,
    // nunca antes (senão court/scheduled_time ficam nulos).
    scheduleAcrossCategories(categoryTiers, courts, input.startTime);

    const allEntries = categoryBuilds.flatMap(({ categoryId, entries }) =>
      entries.map((e) => ({
        id: e.id,
        category_id: categoryId,
        player_id_1: e.playerIds[0],
        player_id_2: e.playerIds[1] ?? null,
      })),
    );
    const allGroups = categoryBuilds.flatMap(({ categoryId, built }) =>
      built.groups.map((g) => ({ id: g.id, category_id: categoryId, name: g.name })),
    );
    const allGroupEntries = categoryBuilds.flatMap(({ built }) =>
      built.groupEntries.map((ge) => ({ group_id: ge.groupId, entry_id: ge.entryId })),
    );
    const allMatches: (MatchDraft & { category_id: string })[] = categoryBuilds.flatMap(({ categoryId, built }) =>
      built.matches.map((m) => ({ ...m, category_id: categoryId })),
    );

    if (allEntries.length > 0) {
      const { error } = await supabase.from("entries").insert(allEntries);
      if (error) throw new Error(`entries: ${error.message}`);
    }
    if (allGroups.length > 0) {
      const { error } = await supabase.from("groups").insert(allGroups);
      if (error) throw new Error(`groups: ${error.message}`);
    }
    if (allGroupEntries.length > 0) {
      const { error } = await supabase.from("group_entries").insert(allGroupEntries);
      if (error) throw new Error(`group_entries: ${error.message}`);
    }
    if (allMatches.length > 0) {
      const { error } = await supabase.from("matches").insert(
        allMatches.map((m) => ({
          id: m.id,
          category_id: m.category_id,
          group_id: m.groupId,
          stage: m.stage,
          round: m.round,
          bracket_slot: m.bracketSlot,
          court: m.court,
          scheduled_time: m.scheduledTime,
          team_a: m.teamA,
          team_b: m.teamB,
          sets: m.sets,
          completed: m.completed,
          winner_side: m.winnerSide,
        })),
      );
      if (error) throw new Error(`matches: ${error.message}`);
    }
  } catch (e) {
    // aborta e limpa o torneio parcialmente criado (cascade cuida do resto)
    await supabase.from("tournaments").delete().eq("id", tournamentRow.id);
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    console.error("createTournament: rolled back", message);
    return fail(`Não foi possível criar o torneio: ${message}`);
  }

  return { ok: true, message: `Torneio criado! Código: ${tournamentRow.public_code}`, code: tournamentRow.public_code };
}

export async function deleteTournament(
  tournamentId: string,
  _prevState: ActionResult | undefined,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("deleteTournament: no authenticated user", authError);
    return fail("Sessão expirada. Atualize a página e faça login de novo.");
  }

  const { error, count } = await supabase
    .from("tournaments")
    .delete({ count: "exact" })
    .eq("id", tournamentId)
    .eq("organizer_id", user.id);
  if (error) {
    console.error("deleteTournament: delete failed", error);
    return fail(`Não foi possível excluir: ${error.message}`);
  }
  if (!count) {
    return fail("Torneio não encontrado (ou você não é o organizador).");
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
