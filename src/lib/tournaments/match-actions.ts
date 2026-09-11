"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { checkResult, hasAnyScore, type SetScore } from "@/lib/tournament-logic/results";
import {
  QUALIFIERS_PER_GROUP,
  buildKnockoutMatches,
  crossGroupsFirstRound,
  isGroupStageComplete,
  planBracketAdvance,
} from "@/lib/tournament-logic/knockout";
import { minutesSinceStart, scheduleKnockout } from "@/lib/tournament-logic/schedule";
import type { MatchTeam } from "@/lib/tournament-logic/types";

const MATCH_COLUMNS =
  "id, category_id, group_id, stage, round, bracket_slot, court, scheduled_time, team_a, team_b, sets, completed, winner_side";

type MatchRow = {
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

type Context = {
  supabase: SupabaseClient;
  category: { id: string; format: string; sets_to_win: number; max_sets: number; config: Record<string, unknown> | null };
  tournament: { id: string; public_code: string; courts: string[]; start_time: string };
};

const DEFAULT_DURATION = 40;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Usuário logado + categoria + torneio, garantindo que o usuário é o organizador. */
async function loadContext(categoryId: string): Promise<{ ok: true; ctx: Context } | { ok: false; error: string }> {
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
    return { ok: false, error: "Partida não encontrada (ou você não é o organizador deste torneio)." };
  }
  return { ok: true, ctx: { supabase, category, tournament } };
}

function revalidateTournament(t: Context["tournament"]) {
  revalidatePath(`/dashboard/${t.id}`);
  revalidatePath(`/t/${t.public_code}`);
}

const toBracket = (m: MatchRow) => ({
  id: m.id,
  round: m.round,
  bracketSlot: m.bracket_slot,
  teamA: m.team_a,
  teamB: m.team_b,
  sets: m.sets,
  winnerSide: m.winner_side,
});

/** Só aceita até 3 sets com números inteiros ou null — o resto vira null. */
function sanitizeSets(raw: unknown): SetScore[] {
  const list = Array.isArray(raw) ? raw.slice(0, 3) : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return list.map((s) => ({ a: num((s as SetScore)?.a), b: num((s as SetScore)?.b) }));
}

async function loadMatch(matchId: string): Promise<{ ok: true; match: MatchRow; ctx: Context } | { ok: false; error: string }> {
  if (typeof matchId !== "string" || !matchId) return { ok: false, error: "Partida inválida." };
  const supabase = await createClient();
  const { data: match } = await supabase.from("matches").select(MATCH_COLUMNS).eq("id", matchId).maybeSingle();
  if (!match) return { ok: false, error: "Partida não encontrada." };
  const loaded = await loadContext(match.category_id);
  if (!loaded.ok) return loaded;
  return { ok: true, match: match as MatchRow, ctx: loaded.ctx };
}

/**
 * Lança (ou corrige, ou limpa) o placar de uma partida. O servidor
 * recalcula vencedor/finalizado; no mata-mata, leva o vencedor pra
 * próxima partida. Resultados de grupo travam depois que o mata-mata da
 * categoria é gerado (a chave foi montada com a classificação antiga).
 */
export async function saveMatchResult(matchId: string, rawSets: unknown): Promise<ActionResult> {
  const loaded = await loadMatch(matchId);
  if (!loaded.ok) return fail(loaded.error);
  const { match, ctx } = loaded;
  const { supabase, category } = ctx;

  if (!match.team_a || !match.team_b) return fail("Essa partida ainda não tem as duas duplas definidas.");
  if (match.team_a.bye || match.team_b.bye) return fail("Partida com BYE não tem placar.");

  const result = checkResult(sanitizeSets(rawSets), category.sets_to_win, category.max_sets);
  if (!result.ok) return fail(result.error);

  let advance: { nextId: string; side: "teamA" | "teamB"; team: MatchTeam } | null = null;
  if (match.stage === "group" && category.format === "grupos") {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("category_id", category.id)
      .eq("stage", "bracket");
    if (count) {
      return fail(
        "O mata-mata já foi gerado, então os resultados dos grupos estão travados. Para corrigir, desfaça o mata-mata (só dá enquanto nenhum jogo dele tiver placar).",
      );
    }
  }
  if (match.stage === "bracket") {
    const { data: bracket, error } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("category_id", category.id)
      .eq("stage", "bracket");
    if (error || !bracket) return fail("Não foi possível ler a chave do mata-mata.");
    const plan = planBracketAdvance(
      { ...toBracket(match), sets: result.sets, winnerSide: result.winnerSide },
      (bracket as MatchRow[]).map(toBracket),
    );
    if (!plan.ok) return fail(plan.error);
    advance = plan.change;
  }

  const { data: updated, error: updateError } = await supabase
    .from("matches")
    .update({ sets: result.sets, completed: result.completed, winner_side: result.winnerSide })
    .eq("id", match.id)
    .select("id");
  if (updateError || !updated?.length) {
    console.error("saveMatchResult: update failed", updateError);
    return fail(`Não foi possível salvar o placar${updateError ? `: ${updateError.message}` : "."}`);
  }

  if (advance) {
    const column = advance.side === "teamA" ? "team_a" : "team_b";
    const { error } = await supabase.from("matches").update({ [column]: advance.team }).eq("id", advance.nextId);
    if (error) {
      // salvar de novo é seguro: o avanço é recalculado a partir do placar salvo
      console.error("saveMatchResult: advance failed", error);
      revalidateTournament(ctx.tournament);
      return fail("Placar salvo, mas não consegui levar o vencedor para a próxima fase. Toque em salvar de novo.");
    }
  }

  revalidateTournament(ctx.tournament);
  if (result.completed) return ok("Placar salvo — jogo finalizado.");
  return ok(hasAnyScore(result.sets) ? "Placar parcial salvo." : "Placar apagado.");
}

/** Muda quadra e/ou horário de uma partida. Avisa (sem bloquear) se a quadra já tem jogo no mesmo horário. */
export async function saveMatchSchedule(matchId: string, court: string | null, time: string | null): Promise<ActionResult> {
  const loaded = await loadMatch(matchId);
  if (!loaded.ok) return fail(loaded.error);
  const { match, ctx } = loaded;
  const { supabase, tournament } = ctx;

  const newCourt = court || null;
  const newTime = time || null;
  if (newCourt !== null && !(tournament.courts ?? []).includes(newCourt)) return fail("Quadra inválida.");
  if (newTime !== null && !TIME_RE.test(newTime)) return fail("Horário inválido (use HH:MM).");

  const { data: updated, error } = await supabase
    .from("matches")
    .update({ court: newCourt, scheduled_time: newTime })
    .eq("id", match.id)
    .select("id");
  if (error || !updated?.length) return fail(`Não foi possível salvar o horário${error ? `: ${error.message}` : "."}`);

  let warning = "";
  if (newCourt && newTime) {
    const { data: cats } = await supabase.from("categories").select("id").eq("tournament_id", tournament.id);
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("category_id", (cats ?? []).map((c) => c.id))
      .eq("court", newCourt)
      .eq("scheduled_time", newTime)
      .neq("id", match.id);
    if (count) warning = ` Atenção: a ${newCourt} já tem outro jogo às ${newTime}.`;
  }

  revalidateTournament(tournament);
  return ok(`Horário salvo.${warning}`);
}

/** Duração dos jogos da categoria: gravada no config; em torneios antigos, deduzida da agenda. */
function categoryDuration(config: Record<string, unknown> | null, matches: MatchRow[], startTime: string): number {
  const stored = Number(config?.durationMinutes);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const byCourt = new Map<string, number[]>();
  matches.forEach((m) => {
    if (m.court && m.scheduled_time) byCourt.set(m.court, [...(byCourt.get(m.court) ?? []), minutesSinceStart(startTime, m.scheduled_time)]);
  });
  let gap = Infinity;
  byCourt.forEach((times) => {
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) if (times[i] > times[i - 1]) gap = Math.min(gap, times[i] - times[i - 1]);
  });
  return Number.isFinite(gap) ? gap : DEFAULT_DURATION;
}

/**
 * Gera o mata-mata de uma categoria "grupos" a partir da classificação:
 * 2 por grupo, cruzamento 1ºA×2ºB / 1ºB×2ºA em metades opostas, agendado
 * depois do último jogo de grupo (e dos jogos já agendados nas quadras).
 */
export async function generateKnockout(categoryId: string): Promise<ActionResult> {
  const loaded = await loadContext(categoryId);
  if (!loaded.ok) return fail(loaded.error);
  const { supabase, category, tournament } = loaded.ctx;
  if (category.format !== "grupos") return fail("Só categorias de fase de grupos geram mata-mata.");

  const [{ data: groups }, { data: catMatches }, { data: cats }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("category_id", category.id),
    supabase.from("matches").select(MATCH_COLUMNS).eq("category_id", category.id),
    supabase.from("categories").select("id, config").eq("tournament_id", tournament.id),
  ]);
  const matches = (catMatches ?? []) as MatchRow[];
  if (matches.some((m) => m.stage === "bracket")) return fail("O mata-mata dessa categoria já foi gerado.");
  if (!isGroupStageComplete(matches)) return fail("Ainda há jogos de grupo sem resultado.");

  const groupMatches = matches.filter((m) => m.stage === "group");
  const cross = crossGroupsFirstRound(
    groups ?? [],
    groupMatches.map((m) => ({ groupId: m.group_id, teamA: m.team_a, teamB: m.team_b, sets: m.sets, completed: m.completed, winnerSide: m.winner_side })),
    QUALIFIERS_PER_GROUP,
  );
  if (!cross.ok) return fail(cross.error);

  const start = tournament.start_time;
  const duration = categoryDuration(category.config, groupMatches, start);
  const knockout = buildKnockoutMatches(cross.pairs, duration);

  // quando cada quadra fica livre, considerando todas as categorias do torneio
  const catIds = (cats ?? []).map((c) => c.id);
  const { data: allMatches } = await supabase.from("matches").select(MATCH_COLUMNS).in("category_id", catIds);
  const all = (allMatches ?? []) as MatchRow[];
  const durationByCat = new Map(
    (cats ?? []).map((c) => [c.id, categoryDuration(c.config, all.filter((m) => m.category_id === c.id), start)]),
  );
  const endOf = (m: MatchRow) => minutesSinceStart(start, m.scheduled_time!) + (durationByCat.get(m.category_id) ?? duration);
  const courtFreeFrom: Record<string, number> = {};
  all.forEach((m) => {
    if (m.court && m.scheduled_time) courtFreeFrom[m.court] = Math.max(courtFreeFrom[m.court] ?? 0, endOf(m));
  });
  const notBefore = Math.max(0, ...groupMatches.filter((m) => m.scheduled_time).map(endOf));
  if ((tournament.courts ?? []).length > 0) scheduleKnockout(knockout, tournament.courts, start, courtFreeFrom, notBefore);

  const { error } = await supabase.from("matches").insert(
    knockout.map((m) => ({
      id: m.id,
      category_id: category.id,
      group_id: null,
      stage: m.stage,
      round: m.round,
      bracket_slot: m.bracketSlot,
      court: m.court,
      scheduled_time: m.scheduledTime,
      team_a: m.teamA,
      team_b: m.teamB,
      sets: m.sets,
      completed: false,
      winner_side: null,
    })),
  );
  if (error) {
    console.error("generateKnockout: insert failed", error);
    return fail(`Não foi possível gerar o mata-mata: ${error.message}`);
  }

  revalidateTournament(tournament);
  return ok("Mata-mata gerado e agendado.");
}

/** Desfaz o mata-mata de uma categoria "grupos" — só enquanto nenhum jogo dele tiver placar. */
export async function undoKnockout(categoryId: string): Promise<ActionResult> {
  const loaded = await loadContext(categoryId);
  if (!loaded.ok) return fail(loaded.error);
  const { supabase, category, tournament } = loaded.ctx;
  if (category.format !== "grupos") return fail("Nessa categoria o mata-mata é o próprio torneio; não dá para desfazer.");

  const { data: bracket } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("category_id", category.id)
    .eq("stage", "bracket");
  if (!bracket?.length) return fail("Essa categoria não tem mata-mata gerado.");
  if ((bracket as MatchRow[]).some((m) => hasAnyScore(m.sets))) {
    return fail("Algum jogo do mata-mata já tem placar. Limpe esses placares antes de desfazer.");
  }

  const { error } = await supabase.from("matches").delete().eq("category_id", category.id).eq("stage", "bracket");
  if (error) return fail(`Não foi possível desfazer o mata-mata: ${error.message}`);

  revalidateTournament(tournament);
  return ok("Mata-mata desfeito. Os resultados dos grupos podem ser corrigidos de novo.");
}
