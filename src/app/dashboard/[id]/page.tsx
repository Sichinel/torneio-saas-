import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import type { SetScore } from "@/lib/tournament-logic/results";
import { computeGroupStandings } from "@/lib/tournament-logic/standings";
import { QUALIFIERS_PER_GROUP, isGroupStageComplete, knockoutRoundLabel } from "@/lib/tournament-logic/knockout";
import { hasAnyScore } from "@/lib/tournament-logic/results";
import { inferDurationMinutes } from "@/lib/tournament-logic/schedule";
import { findScheduleConflicts, scheduledMatchesFromRows } from "@/lib/tournament-logic/conflicts";
import { DeleteTournamentButton } from "@/components/tournaments/DeleteTournamentButton";
import { MatchEditor } from "@/components/tournaments/MatchEditor";
import { KnockoutControls } from "@/components/tournaments/KnockoutControls";
import { StandingsTable } from "@/components/tournaments/StandingsTable";
import { GroupEditor, type GrupoComDuplas } from "@/components/tournaments/GroupEditor";
import { TournamentDateEditor } from "@/components/tournaments/TournamentDateEditor";

export const metadata = { title: "Torneio — Torneio" };

const FORMAT_LABEL: Record<string, string> = {
  grupos: "Fase de grupos + mata-mata",
  mata: "Eliminatórias diretas",
  americano: "Americano",
  super8: "Super 8",
};

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

const byTime = (a: MatchRow, b: MatchRow) =>
  (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99") || (a.court ?? "").localeCompare(b.court ?? "");

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, public_code, courts, start_time, organizer_id, event_date")
    .eq("id", id)
    .maybeSingle();

  if (!tournament || tournament.organizer_id !== user?.id) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, format, max_sets, config")
    .eq("tournament_id", tournament.id)
    .order("created_at");

  const categoryIds = (categories ?? []).map((c) => c.id);
  const [{ data: groups }, { data: matchData }, { data: groupEntries }] = await Promise.all([
    categoryIds.length
      ? supabase.from("groups").select("id, category_id, name").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as { id: string; category_id: string; name: string }[] }),
    categoryIds.length
      ? supabase
          .from("matches")
          .select("id, category_id, group_id, stage, round, bracket_slot, court, scheduled_time, team_a, team_b, sets, completed, winner_side")
          .in("category_id", categoryIds)
      : Promise.resolve({ data: [] as MatchRow[] }),
    categoryIds.length
      ? supabase.from("group_entries").select("group_id, entry_id")
      : Promise.resolve({ data: [] as { group_id: string; entry_id: string }[] }),
  ]);
  const matches = (matchData ?? []) as MatchRow[];
  const courts: string[] = tournament.courts ?? [];
  const durationByCat = new Map(
    (categories ?? []).map((c) => [
      c.id,
      inferDurationMinutes(c.config, matches.filter((m) => m.category_id === c.id), tournament.start_time),
    ]),
  );
  const conflicts = findScheduleConflicts(scheduledMatchesFromRows(matches, (id) => durationByCat.get(id) ?? 40));

  // Nome de cada dupla vem desnormalizado nos jogos; é o que o editor de
  // grupos mostra, sem precisar ler entries + players de novo.
  const nomeDaDupla = new Map<string, string>();
  matches.forEach((m) => {
    [m.team_a, m.team_b].forEach((t) => {
      if (t?.entryId && !t.bye) nomeDaDupla.set(t.entryId, t.name);
    });
  });

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 16px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            ← Meus torneios
          </Link>
        </div>
      </div>

      <div className="section-title">
        <h2>{tournament.name}</h2>
        <DeleteTournamentButton tournamentId={tournament.id} />
      </div>

      <div className="share-box glass">
        <span>Página pública (ao vivo, sem login):</span>
        <code>/t/{tournament.public_code}</code>
        <Link href={`/t/${tournament.public_code}`} className="btn btn-ghost btn-sm" target="_blank">
          Abrir
        </Link>
        <span className="t-card-meta">
          {courts.length} quadra(s) · início {tournament.start_time?.slice(0, 5)}
        </span>
        <TournamentDateEditor tournamentId={tournament.id} eventDate={tournament.event_date ?? null} />
      </div>

      {conflicts.size > 0 && (
        <div className="conflict-banner" role="status">
          ⚠ {conflicts.size} jogo(s) com conflito de horário — marcados em vermelho abaixo. Ajuste a quadra ou o horário de
          um deles para resolver.
        </div>
      )}

      {(categories ?? []).length === 0 && <div className="empty glass">Esse torneio não tem categorias.</div>}

      {(categories ?? []).map((cat) => {
        const catMatches = matches.filter((m) => m.category_id === cat.id);
        const groupMatches = catMatches.filter((m) => m.stage === "group");
        const bracket = catMatches
          .filter((m) => m.stage === "bracket")
          .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));
        const others = catMatches.filter((m) => m.stage !== "group" && m.stage !== "bracket").sort(byTime);
        const catGroups = (groups ?? [])
          .filter((g) => g.category_id === cat.id)
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        const totalRounds = bracket.length ? Math.max(...bracket.map((m) => m.round ?? 0)) + 1 : 0;
        const editor = (m: MatchRow, label?: string) => (
          <MatchEditor
            key={m.id}
            match={m}
            courts={courts}
            maxSets={cat.max_sets}
            label={label}
            conflicts={conflicts.get(m.id)}
          />
        );

        return (
          <div key={cat.id} className="panel glass" style={{ marginBottom: 24 }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              <h2 style={{ fontSize: 18 }}>{cat.name}</h2>
              <span className="t-card-meta">
                {FORMAT_LABEL[cat.format] ?? cat.format} · {catMatches.length} partida(s)
              </span>
            </div>

            {catMatches.length === 0 && <div className="hint">Nenhuma partida gerada ainda.</div>}

            {cat.format === "grupos" && catGroups.length > 1 && (
              <GroupEditor
                categoryId={cat.id}
                grupos={catGroups.map(
                  (g): GrupoComDuplas => ({
                    id: g.id,
                    name: g.name,
                    duplas: (groupEntries ?? [])
                      .filter((ge) => ge.group_id === g.id)
                      .map((ge) => ({ entryId: ge.entry_id, name: nomeDaDupla.get(ge.entry_id) ?? "Dupla" }))
                      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
                  }),
                )}
              />
            )}

            {catGroups.map((g) => {
              const gm = groupMatches.filter((m) => m.group_id === g.id);
              const rows = computeGroupStandings(
                gm.map((m) => ({ teamA: m.team_a, teamB: m.team_b, sets: m.sets, completed: m.completed, winnerSide: m.winner_side })),
              );
              return (
                <div className="group-block" key={g.id}>
                  <div className="group-title">
                    {g.name}
                    <span className="count">
                      {gm.filter((m) => m.completed).length}/{gm.length} jogos finalizados
                    </span>
                  </div>
                  {cat.format === "grupos" && <StandingsTable rows={rows} highlight={QUALIFIERS_PER_GROUP} />}
                  {[...gm].sort(byTime).map((m) => editor(m))}
                </div>
              );
            })}

            {groupMatches.some((m) => !m.group_id) && (
              <div className="group-block">{groupMatches.filter((m) => !m.group_id).sort(byTime).map((m) => editor(m))}</div>
            )}

            {cat.format === "grupos" && (
              <div className="group-block">
                <div className="group-title" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span>Mata-mata</span>
                  {bracket.length > 0 && !bracket.some((m) => hasAnyScore(m.sets)) && (
                    <KnockoutControls categoryId={cat.id} mode="undo" />
                  )}
                </div>
                {bracket.length === 0 &&
                  (isGroupStageComplete(catMatches) ? (
                    <div className="edit-row">
                      <KnockoutControls categoryId={cat.id} mode="generate" />
                    </div>
                  ) : (
                    <div className="hint">
                      Quando todos os jogos de grupo tiverem resultado, aparece aqui o botão para gerar o mata-mata.
                    </div>
                  ))}
              </div>
            )}

            {bracket.map((m) => editor(m, knockoutRoundLabel(m.round ?? 0, totalRounds)))}

            {others.map((m) => editor(m, m.round !== null ? `Rodada ${m.round + 1}` : undefined))}
          </div>
        );
      })}
    </div>
  );
}
