"use server";

import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { hasAnyScore } from "@/lib/tournament-logic/results";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import { MATCH_COLUMNS, loadCategoryContext, revalidateTournament, type MatchRow } from "./context";
import { resolvePlayersFromLines, toPlayerBank } from "./resolve-entries";

const stripTeam = (t: NonNullable<MatchTeam>): NonNullable<MatchTeam> => ({ entryId: t.entryId, playerIds: t.playerIds, name: t.name });

/**
 * Ajuste manual do sorteio: troca duas duplas de grupos diferentes. X
 * assume exatamente os jogos (e horários) de Y no grupo de Y e vice-versa
 * — por isso a agenda continua sem ninguém em dois lugares ao mesmo tempo.
 * Só antes do mata-mata e enquanto os jogos dessas duplas não têm placar.
 */
export async function swapEntriesBetweenGroups(categoryId: string, entryX: string, entryY: string): Promise<ActionResult> {
  const loaded = await loadCategoryContext(categoryId);
  if (!loaded.ok) return fail(loaded.error);
  const { supabase, category, tournament } = loaded.ctx;
  if (category.format !== "grupos") return fail("Troca entre grupos só vale para categorias de fase de grupos.");
  if (typeof entryX !== "string" || typeof entryY !== "string" || !entryX || !entryY || entryX === entryY) {
    return fail("Escolha duas duplas diferentes.");
  }

  const [{ data: groups }, { data: links }, { data: catMatches }] = await Promise.all([
    supabase.from("groups").select("id").eq("category_id", category.id),
    supabase.from("group_entries").select("group_id, entry_id").in("entry_id", [entryX, entryY]),
    supabase.from("matches").select(MATCH_COLUMNS).eq("category_id", category.id),
  ]);
  const groupIds = new Set((groups ?? []).map((g) => g.id));
  const gX = (links ?? []).find((l) => l.entry_id === entryX && groupIds.has(l.group_id))?.group_id;
  const gY = (links ?? []).find((l) => l.entry_id === entryY && groupIds.has(l.group_id))?.group_id;
  if (!gX || !gY) return fail("Dupla não encontrada nos grupos desta categoria.");
  if (gX === gY) return fail("As duas duplas já estão no mesmo grupo.");

  const matches = (catMatches ?? []) as MatchRow[];
  if (matches.some((m) => m.stage === "bracket")) return fail("O mata-mata já foi gerado. Desfaça o mata-mata antes de mexer nos grupos.");
  const involves = (m: MatchRow, id: string) => m.team_a?.entryId === id || m.team_b?.entryId === id;
  const involved = matches.filter((m) => m.stage === "group" && (involves(m, entryX) || involves(m, entryY)));
  if (involved.some((m) => hasAnyScore(m.sets))) {
    return fail("Uma dessas duplas já tem jogo com placar. Só dá para trocar duplas cujos jogos ainda não começaram.");
  }

  const teamOf = (id: string) => {
    for (const m of involved) {
      if (m.team_a?.entryId === id) return stripTeam(m.team_a);
      if (m.team_b?.entryId === id) return stripTeam(m.team_b);
    }
    return null;
  };
  const tX = teamOf(entryX);
  const tY = teamOf(entryY);
  if (!tX || !tY) return fail("Não encontrei os jogos dessas duplas.");

  for (const m of involved) {
    const swap = (t: MatchTeam) => (t?.entryId === entryX ? tY : t?.entryId === entryY ? tX : t);
    const { error } = await supabase.from("matches").update({ team_a: swap(m.team_a), team_b: swap(m.team_b) }).eq("id", m.id);
    if (error) {
      console.error("swapEntriesBetweenGroups: match update failed", error);
      revalidateTournament(tournament);
      return fail("A troca ficou incompleta (erro ao atualizar um jogo). Confira os grupos antes de continuar.");
    }
  }

  // ignoreDuplicates deixa repetir a operação sem erro de chave duplicada
  const { error: linkError } = await supabase.from("group_entries").upsert(
    [
      { group_id: gY, entry_id: entryX },
      { group_id: gX, entry_id: entryY },
    ],
    { onConflict: "group_id,entry_id", ignoreDuplicates: true },
  );
  const { error: unlinkX } = linkError ? { error: null } : await supabase.from("group_entries").delete().eq("group_id", gX).eq("entry_id", entryX);
  const { error: unlinkY } = linkError ? { error: null } : await supabase.from("group_entries").delete().eq("group_id", gY).eq("entry_id", entryY);
  if (linkError || unlinkX || unlinkY) {
    console.error("swapEntriesBetweenGroups: group_entries failed", linkError ?? unlinkX ?? unlinkY);
    revalidateTournament(tournament);
    return fail("Os jogos foram trocados, mas não consegui atualizar a lista dos grupos. Tente de novo.");
  }

  revalidateTournament(tournament);
  return ok(`Troca feita: ${tX.name} ↔ ${tY.name}.`);
}

/**
 * Substitui um jogador de uma dupla (ex.: desistência). O jogador novo vem
 * do banco do organizador (ou é criado). Atualiza o nome/ids da dupla em
 * todos os jogos dela; placares já lançados continuam valendo.
 */
export async function replacePlayerInEntry(entryId: string, slot: number, newName: string): Promise<ActionResult> {
  if (slot !== 0 && slot !== 1) return fail("Jogador inválido.");
  const name = typeof newName === "string" ? newName.trim() : "";
  if (!name) return fail("Digite o nome do jogador novo.");
  if (name.length > 60) return fail("Nome muito longo.");
  if (typeof entryId !== "string" || !entryId) return fail("Dupla inválida.");

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("entries")
    .select("id, category_id, player_id_1, player_id_2")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return fail("Dupla não encontrada.");
  const loaded = await loadCategoryContext(entry.category_id);
  if (!loaded.ok) return fail(loaded.error);
  const { category, tournament, userId } = loaded.ctx;
  const db = loaded.ctx.supabase;
  if (category.format !== "grupos" && category.format !== "mata") {
    return fail("Troca de jogador só está disponível para duplas fixas (grupos ou mata-mata).");
  }
  if (slot === 1 && !entry.player_id_2) return fail("Essa dupla só tem um jogador.");

  const { data: bankRows, error: bankError } = await db.from("players").select("id, name, side").eq("owner_id", userId);
  if (bankError) return fail("Não foi possível ler seu banco de jogadores.");
  let player;
  try {
    player = (await resolvePlayersFromLines(db, userId, [name], toPlayerBank(bankRows ?? []))).get(name);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Não foi possível cadastrar o jogador.");
  }
  if (!player) return fail("Não entendi esse nome.");

  const currentId = slot === 0 ? entry.player_id_1 : entry.player_id_2;
  const otherId = slot === 0 ? entry.player_id_2 : entry.player_id_1;
  if (player.id === otherId) return fail("Esse jogador já está nesta dupla.");

  // se já é o jogador atual (ex.: repetindo uma troca que falhou no meio), só ressincroniza os jogos
  if (player.id !== currentId) {
    const { data: catEntries } = await db.from("entries").select("id, player_id_1, player_id_2").eq("category_id", category.id);
    if ((catEntries ?? []).some((e) => e.id !== entry.id && (e.player_id_1 === player.id || e.player_id_2 === player.id))) {
      return fail(`${player.name} já está em outra dupla desta categoria.`);
    }
    const column = slot === 0 ? "player_id_1" : "player_id_2";
    const { data: updated, error: entryError } = await db.from("entries").update({ [column]: player.id }).eq("id", entry.id).select("id");
    if (entryError || !updated?.length) return fail(`Não foi possível trocar o jogador${entryError ? `: ${entryError.message}` : "."}`);
  }

  const ids = slot === 0 ? [player.id, entry.player_id_2] : [entry.player_id_1, player.id];
  const playerIds = ids.filter((x): x is string => !!x);
  const { data: named } = await db.from("players").select("id, name").in("id", playerIds);
  const nameOf = new Map((named ?? []).map((p) => [p.id, p.name as string]));
  const teamName = playerIds.map((id) => nameOf.get(id) ?? "?").join(" / ");

  const { data: catMatches } = await db.from("matches").select(MATCH_COLUMNS).eq("category_id", category.id);
  for (const m of (catMatches ?? []) as MatchRow[]) {
    const patch: Record<string, MatchTeam> = {};
    if (m.team_a?.entryId === entry.id) patch.team_a = { entryId: entry.id, playerIds, name: teamName };
    if (m.team_b?.entryId === entry.id) patch.team_b = { entryId: entry.id, playerIds, name: teamName };
    if (Object.keys(patch).length === 0) continue;
    const { error } = await db.from("matches").update(patch).eq("id", m.id);
    if (error) {
      console.error("replacePlayerInEntry: match update failed", error);
      revalidateTournament(tournament);
      return fail("Jogador trocado, mas algum jogo ainda mostra o nome antigo. Tente de novo.");
    }
  }

  revalidateTournament(tournament);
  return ok(`Dupla atualizada: ${teamName}.`);
}
