import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import { DeleteTournamentButton } from "@/components/tournaments/DeleteTournamentButton";

export const metadata = { title: "Torneio — Torneio" };

const FORMAT_LABEL: Record<string, string> = {
  grupos: "Fase de grupos",
  mata: "Eliminatórias diretas",
  americano: "Americano",
  super8: "Super 8",
};

const STAGE_LABEL: Record<string, string> = {
  group: "Grupos",
  bracket: "Eliminatórias",
  americano_round: "Rodada",
  super8_round: "Rodada",
  super8_final_a: "Final A",
  super8_final_b: "Final B",
};

function teamLabel(team: MatchTeam): string {
  if (!team) return "A definir";
  if (team.bye) return "BYE";
  return team.name;
}

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, public_code, courts, start_time, organizer_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!tournament || tournament.organizer_id !== user?.id) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, format, team_type, sets_to_win")
    .eq("tournament_id", tournament.id)
    .order("created_at");

  const categoryIds = (categories ?? []).map((c) => c.id);

  const [{ data: groups }, { data: matches }, { data: entries }] = await Promise.all([
    categoryIds.length
      ? supabase.from("groups").select("id, category_id, name").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as { id: string; category_id: string; name: string }[] }),
    categoryIds.length
      ? supabase
          .from("matches")
          .select("id, category_id, group_id, stage, round, court, scheduled_time, team_a, team_b, completed, winner_side")
          .in("category_id", categoryIds)
          .order("scheduled_time", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    categoryIds.length
      ? supabase.from("entries").select("id, category_id").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as { id: string; category_id: string }[] }),
  ]);

  const groupNameById = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
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
      <div className="t-card-meta" style={{ marginBottom: 20 }}>
        Código público{" "}
        <code
          style={{
            fontFamily: "var(--font-display)",
            background: "rgba(79,168,255,.12)",
            padding: "2px 7px",
            borderRadius: 6,
          }}
        >
          {tournament.public_code}
        </code>{" "}
        · {tournament.courts?.length ?? 0} quadra(s) · início {tournament.start_time}
      </div>

      <div className="panel glass" style={{ marginBottom: 20 }}>
        <div className="hint">
          Visão temporária do organizador (ainda sem edição de placar nem link público — passo 9). Confirma que o
          sorteio gerou grupos e partidas corretamente.
        </div>
      </div>

      {(categories ?? []).length === 0 && <div className="empty glass">Essa categoria não tem dados ainda.</div>}

      {(categories ?? []).map((cat) => {
        const catMatches = (matches ?? []).filter((m) => m.category_id === cat.id);
        const catEntries = (entries ?? []).filter((e) => e.category_id === cat.id);

        const byGroup = new Map<string, typeof catMatches>();
        const ungrouped: typeof catMatches = [];
        catMatches.forEach((m) => {
          if (m.group_id) {
            const list = byGroup.get(m.group_id) ?? [];
            list.push(m);
            byGroup.set(m.group_id, list);
          } else {
            ungrouped.push(m);
          }
        });

        return (
          <div key={cat.id} className="panel glass" style={{ marginBottom: 24 }}>
            <div className="section-title" style={{ marginTop: 0 }}>
              <h2 style={{ fontSize: 18 }}>{cat.name}</h2>
              <span className="t-card-meta">
                {FORMAT_LABEL[cat.format] ?? cat.format} · {catEntries.length} participante(s) · {catMatches.length}{" "}
                partida(s)
              </span>
            </div>

            {catMatches.length === 0 && <div className="hint">Nenhuma partida gerada ainda.</div>}

            {[...byGroup.entries()].map(([groupId, groupMatches]) => (
              <div className="group-block" key={groupId}>
                <div className="group-title">
                  {groupNameById.get(groupId) ?? "Grupo"}
                  <span className="count">{groupMatches.length} partida(s)</span>
                </div>
                {groupMatches.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            ))}

            {ungrouped.length > 0 && (
              <div className="group-block">
                {byGroup.size > 0 && (
                  <div className="group-title">
                    {STAGE_LABEL[ungrouped[0].stage] ?? ungrouped[0].stage}
                    <span className="count">{ungrouped.length} partida(s)</span>
                  </div>
                )}
                {ungrouped.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MatchRow({
  match,
}: {
  match: {
    id: string;
    stage: string;
    round: number | null;
    court: string | null;
    scheduled_time: string | null;
    team_a: MatchTeam;
    team_b: MatchTeam;
    completed: boolean;
    winner_side: "A" | "B" | null;
  };
}) {
  return (
    <div className="match glass">
      <div className="match-top">
        <div className="tags">
          <span className="badge">{match.court ?? "Sem quadra"}</span>
          <span className="badge">{match.scheduled_time ?? "--:--"}</span>
          {match.round != null && <span className="badge">Rodada {match.round}</span>}
        </div>
        <span className={`badge ${match.completed ? "done" : ""}`}>
          {match.completed ? "Finalizado" : "Agendado"}
        </span>
      </div>
      <div className="match-teams">
        <div className={`team-name ${match.winner_side === "A" ? "winner" : ""} ${match.team_a?.bye ? "bye" : ""}`}>
          {teamLabel(match.team_a)}
        </div>
        <div className="hint">vs</div>
        <div className={`team-name ${match.winner_side === "B" ? "winner" : ""} ${match.team_b?.bye ? "bye" : ""}`}>
          {teamLabel(match.team_b)}
        </div>
      </div>
    </div>
  );
}
