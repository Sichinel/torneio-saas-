"use server";

import { createClient } from "@/lib/supabase/server";
import { PRECISA_CONFIRMAR, fail, ok, type ActionResult } from "@/lib/actions/result";
import { hasAnyScore } from "@/lib/tournament-logic/results";
import type { MatchDraft, MatchTeam } from "@/lib/tournament-logic/types";
import { roundRobinMatches } from "@/lib/tournament-logic/roundRobin";
import { inferDurationMinutes, scheduleAcrossCategories } from "@/lib/tournament-logic/schedule";
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

/** Chave de um confronto, independente de quem é A e quem é B. */
function confrontoKey(a: string | undefined, b: string | undefined): string {
  return [a ?? "", b ?? ""].sort().join("|");
}

/**
 * Move uma dupla de um grupo para outro e reconstrói a fase de grupos.
 *
 * Diferente de `swapEntriesBetweenGroups`, mover muda o TAMANHO dos
 * grupos, então o rodízio dos dois grupos envolvidos deixa de valer: um
 * grupo de 4 tem 6 jogos, um de 5 tem 10. Por isso os jogos de grupo são
 * regerados em vez de remendados — remendar deixaria jogos órfãos
 * apontando para confrontos que não existem mais.
 *
 * Placar de confronto que sobrevive à mudança é preservado (mesma dupla
 * contra a mesma dupla). O que não sobrevive é contado, e a ação recusa
 * até receber confirmação explícita.
 *
 * A fase de grupos do torneio inteiro é reagendada junto, como no sorteio
 * original: é isso que garante que ninguém fique em duas quadras ao mesmo
 * tempo e que todos tenham descanso entre jogos.
 */
export async function moveEntryToGroup(
  categoryId: string,
  entryId: string,
  targetGroupId: string,
  confirmado: boolean,
): Promise<ActionResult> {
  const loaded = await loadCategoryContext(categoryId);
  if (!loaded.ok) return fail(loaded.error);
  const { supabase, category, tournament } = loaded.ctx;
  if (category.format !== "grupos") return fail("Só categorias de fase de grupos têm grupos para editar.");
  if (typeof entryId !== "string" || !entryId || typeof targetGroupId !== "string" || !targetGroupId) {
    return fail("Escolha uma dupla e um grupo de destino.");
  }

  const { data: cats } = await supabase.from("categories").select("id, config").eq("tournament_id", tournament.id);
  const idsCategorias = (cats ?? []).map((c) => c.id);

  const [{ data: groups }, { data: links }, { data: allMatchRows }] = await Promise.all([
    supabase.from("groups").select("id, name, category_id").eq("category_id", category.id),
    supabase.from("group_entries").select("group_id, entry_id"),
    supabase.from("matches").select(MATCH_COLUMNS).in("category_id", idsCategorias),
  ]);

  const gruposDaCategoria = groups ?? [];
  const destino = gruposDaCategoria.find((g) => g.id === targetGroupId);
  if (!destino) return fail("Grupo de destino não pertence a esta categoria.");

  const todos = (allMatchRows ?? []) as MatchRow[];
  const daCategoria = todos.filter((m) => m.category_id === category.id);
  if (daCategoria.some((m) => m.stage === "bracket")) {
    return fail("O mata-mata já foi gerado. Desfaça o mata-mata antes de mexer nos grupos.");
  }

  const idsDosGrupos = new Set(gruposDaCategoria.map((g) => g.id));
  const vinculos = (links ?? []).filter((l) => idsDosGrupos.has(l.group_id));
  const origem = vinculos.find((l) => l.entry_id === entryId)?.group_id;
  if (!origem) return fail("Dupla não encontrada nos grupos desta categoria.");
  if (origem === targetGroupId) return fail("A dupla já está nesse grupo.");
  if (vinculos.filter((l) => l.group_id === origem).length <= 2) {
    return fail("O grupo de origem ficaria com menos de 2 duplas. Mova outra dupla para lá antes.");
  }

  // Dados das duplas: os jogos já carregam nome e playerIds desnormalizados.
  type Dupla = { id: string; playerIds: string[]; name: string };
  const duplas = new Map<string, Dupla>();
  daCategoria.forEach((m) => {
    [m.team_a, m.team_b].forEach((t) => {
      if (t?.entryId && !t.bye) duplas.set(t.entryId, { id: t.entryId, playerIds: t.playerIds, name: t.name });
    });
  });
  if (!duplas.has(entryId)) return fail("Não encontrei os jogos dessa dupla.");

  // Composição nova dos grupos desta categoria.
  const membros = new Map<string, string[]>();
  gruposDaCategoria.forEach((g) => membros.set(g.id, []));
  vinculos.forEach((l) => {
    const grupoFinal = l.entry_id === entryId ? targetGroupId : l.group_id;
    membros.get(grupoFinal)?.push(l.entry_id);
  });

  const duracaoDe = (config: Record<string, unknown> | null | undefined, rows: MatchRow[]) =>
    inferDurationMinutes(config, rows, tournament.start_time);
  const duracaoCategoria = duracaoDe(category.config, daCategoria);

  const novosDaCategoria = gruposDaCategoria.flatMap((g) => {
    const doGrupo = (membros.get(g.id) ?? [])
      .map((id) => duplas.get(id))
      .filter((d): d is Dupla => !!d);
    return roundRobinMatches(doGrupo, duracaoCategoria, g.id, "group");
  });

  // Outras categorias entram na reagendagem para as quadras não colidirem;
  // os confrontos delas não mudam, só os horários.
  const outras = (cats ?? []).filter((c) => c.id !== category.id);
  const tiersOutras = outras.map((c) => {
    const daOutra = todos.filter((m) => m.category_id === c.id && m.stage === "group");
    const dur = duracaoDe(c.config as Record<string, unknown> | null, daOutra);
    const tier: MatchDraft[] = daOutra.map((m) => ({
      id: m.id,
      groupId: m.group_id,
      stage: "group",
      round: null,
      bracketSlot: null,
      court: null,
      scheduledTime: null,
      teamA: m.team_a,
      teamB: m.team_b,
      sets: m.sets,
      completed: m.completed,
      winnerSide: m.winner_side,
      durationMinutes: dur,
    }));
    return { categoryId: c.id, tier };
  });

  scheduleAcrossCategories(
    [{ tiers: [novosDaCategoria] }, ...tiersOutras.map((o) => ({ tiers: [o.tier] }))],
    tournament.courts ?? [],
    tournament.start_time,
  );

  // Placares existentes, indexados por confronto.
  const placarAntigo = new Map<string, MatchRow>();
  todos
    .filter((m) => m.stage === "group" && hasAnyScore(m.sets))
    .forEach((m) => placarAntigo.set(confrontoKey(m.team_a?.entryId, m.team_b?.entryId), m));

  const chavesNovas = new Set(
    [...novosDaCategoria, ...tiersOutras.flatMap((o) => o.tier)].map((m) =>
      confrontoKey(m.teamA?.entryId, m.teamB?.entryId),
    ),
  );
  const perdidos = [...placarAntigo.entries()].filter(([k]) => !chavesNovas.has(k));
  if (perdidos.length > 0 && !confirmado) {
    const nomes = perdidos
      .map(([, m]) => `${m.team_a?.name ?? "?"} x ${m.team_b?.name ?? "?"}`)
      .slice(0, 3)
      .join("; ");
    return fail(
      `${PRECISA_CONFIRMAR}Isso apaga o placar de ${perdidos.length} jogo(s) que deixam de existir: ${nomes}${perdidos.length > 3 ? "…" : ""}.`,
    );
  }

  const comPlacar = (m: MatchDraft, categoriaId: string) => {
    const antigo = placarAntigo.get(confrontoKey(m.teamA?.entryId, m.teamB?.entryId));
    // winner_side depende de quem é A e quem é B; se os lados inverteram
    // na regeração, o placar e o vencedor invertem junto.
    const inverteu = !!antigo && antigo.team_a?.entryId !== m.teamA?.entryId;
    return {
      id: m.id,
      category_id: categoriaId,
      group_id: m.groupId,
      stage: m.stage,
      round: m.round,
      bracket_slot: m.bracketSlot,
      court: m.court,
      scheduled_time: m.scheduledTime,
      team_a: m.teamA,
      team_b: m.teamB,
      sets: antigo ? (inverteu ? antigo.sets.map((s) => ({ a: s.b, b: s.a })) : antigo.sets) : m.sets,
      completed: antigo?.completed ?? false,
      winner_side: antigo?.winner_side
        ? inverteu
          ? antigo.winner_side === "A"
            ? "B"
            : "A"
          : antigo.winner_side
        : null,
    };
  };

  const linhasNovas = [
    ...novosDaCategoria.map((m) => comPlacar(m, category.id)),
    ...tiersOutras.flatMap((o) => o.tier.map((m) => comPlacar(m, o.categoryId))),
  ];
  const antigasDeGrupo = todos.filter((m) => m.stage === "group");

  const { error: erroDelete } = await supabase
    .from("matches")
    .delete()
    .in(
      "id",
      antigasDeGrupo.map((m) => m.id),
    );
  if (erroDelete) {
    console.error("moveEntryToGroup: delete failed", erroDelete);
    return fail("Não consegui limpar os jogos antigos. Nada foi alterado.");
  }

  const { error: erroInsert } = await supabase.from("matches").insert(linhasNovas);
  if (erroInsert) {
    console.error("moveEntryToGroup: insert failed — restaurando", erroInsert);
    const { error: erroRestore } = await supabase.from("matches").insert(
      antigasDeGrupo.map((m) => ({
        id: m.id,
        category_id: m.category_id,
        group_id: m.group_id,
        stage: m.stage,
        round: m.round,
        bracket_slot: m.bracket_slot,
        court: m.court,
        scheduled_time: m.scheduled_time,
        team_a: m.team_a,
        team_b: m.team_b,
        sets: m.sets,
        completed: m.completed,
        winner_side: m.winner_side,
      })),
    );
    revalidateTournament(tournament);
    return fail(
      erroRestore
        ? "Falha ao gravar os jogos novos E ao restaurar os antigos. Confira a fase de grupos antes de continuar."
        : "Não consegui gravar os jogos novos. Os jogos antigos foram restaurados.",
    );
  }

  const { error: erroLink } = await supabase
    .from("group_entries")
    .upsert([{ group_id: targetGroupId, entry_id: entryId }], {
      onConflict: "group_id,entry_id",
      ignoreDuplicates: true,
    });
  const { error: erroUnlink } = erroLink
    ? { error: null }
    : await supabase.from("group_entries").delete().eq("group_id", origem).eq("entry_id", entryId);
  if (erroLink || erroUnlink) {
    console.error("moveEntryToGroup: group_entries failed", erroLink ?? erroUnlink);
    revalidateTournament(tournament);
    return fail("Os jogos foram regerados, mas a lista dos grupos não atualizou. Tente de novo.");
  }

  revalidateTournament(tournament);
  const dupla = duplas.get(entryId)!;
  return ok(
    `${dupla.name} foi para o ${destino.name}. Fase de grupos regerada e reagendada${
      perdidos.length > 0 ? `; ${perdidos.length} placar(es) apagado(s)` : ""
    }.`,
  );
}
