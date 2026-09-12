"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import { computeGroupStandings } from "@/lib/tournament-logic/standings";
import { QUALIFIERS_PER_GROUP, firstRoundOrigins, knockoutRoundLabel } from "@/lib/tournament-logic/knockout";
import { formatTime, matchStatus } from "@/lib/tournament-logic/display";
import { StandingsTable } from "@/components/tournaments/StandingsTable";
import {
  MATCH_COLUMNS,
  type PublicCategory,
  type PublicGroup,
  type PublicMatch,
  type PublicTournament,
} from "@/lib/tournaments/public-data";

/** Aba aberta. Tipo explícito em vez de string mágica: nome de quadra
 *  vem do organizador e não pode colidir com uma seção fixa. */
type Aba =
  | { kind: "quadra"; court: string }
  | { kind: "sem-quadra" }
  | { kind: "mata-mata" }
  | { kind: "classificacao" };

const mesmaAba = (a: Aba, b: Aba) =>
  a.kind === b.kind && (a.kind !== "quadra" || b.kind !== "quadra" || a.court === b.court);

const ROTULOS: Record<Exclude<Aba["kind"], "quadra">, string> = {
  "sem-quadra": "Sem quadra",
  "mata-mata": "Mata-mata",
  classificacao: "Classificação",
};

const rotuloAba = (a: Aba) => (a.kind === "quadra" ? a.court : ROTULOS[a.kind]);

const chaveAba = (a: Aba) => (a.kind === "quadra" ? `quadra:${a.court}` : a.kind);

const byTime = (a: PublicMatch, b: PublicMatch) =>
  (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99") ||
  (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0);

function teamLabel(team: MatchTeam): string {
  if (!team) return "A definir";
  if (team.bye) return "BYE";
  return team.name;
}

export function PublicTournamentView({
  tournament,
  categories,
  groups,
  initialMatches,
}: {
  tournament: PublicTournament;
  categories: PublicCategory[];
  groups: PublicGroup[];
  initialMatches: PublicMatch[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [matches, setMatches] = useState(initialMatches);
  const [live, setLive] = useState(false);

  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);

  const refetch = useCallback(async () => {
    if (categoryIds.length === 0) return;
    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .in("category_id", categoryIds);
    if (error) {
      console.error("página pública: refetch de partidas falhou", error);
      return;
    }
    if (data) setMatches(data as PublicMatch[]);
  }, [supabase, categoryIds]);

  useEffect(() => {
    if (categoryIds.length === 0) return;
    const doTorneio = new Set(categoryIds);
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Quando o organizador salva um jogo, chegam vários eventos quase
    // juntos. Um refetch só, 250ms depois, cobre todos.
    const agendarRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, 250);
    };

    const channel = supabase
      .channel(`torneio-publico-${tournament.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          // O canal recebe partida de qualquer torneio: o filtro `in` não
          // existe em postgres_changes, então separamos aqui.
          const row = (payload.new ?? payload.old) as { category_id?: string };
          if (row?.category_id && doTorneio.has(row.category_id)) agendarRefetch();
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // Celular que dormiu costuma voltar com o socket morto e placar
    // velho na tela. Ao reabrir, busca de novo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    // Rede de segurança: se o socket morrer sem avisar, ou um evento se
    // perder, a tela nunca fica mais de 25s desatualizada. Amanhã a
    // página vai passar horas aberta em dezenas de celulares — não dá
    // pra depender só do WebSocket se manter vivo esse tempo todo.
    const ronda = setInterval(refetch, 25000);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(ronda);
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(channel);
    };
  }, [supabase, tournament.id, categoryIds, refetch]);

  const courts = tournament.courts ?? [];
  const temSemQuadra = matches.some((m) => !m.court);
  const temMataMata = matches.some((m) => m.stage === "bracket");
  const abas: Aba[] = [
    ...courts.map((c): Aba => ({ kind: "quadra", court: c })),
    ...(temSemQuadra ? [{ kind: "sem-quadra" } as Aba] : []),
    // Só aparece depois que a chave existe: antes disso não há o que ver.
    ...(temMataMata ? [{ kind: "mata-mata" } as Aba] : []),
    { kind: "classificacao" },
  ];

  const [aba, setAba] = useState<Aba>(abas[0] ?? { kind: "classificacao" });
  // Uma quadra pode sumir da lista enquanto está aberta (jogo remarcado).
  const abaAtual: Aba = abas.find((a) => mesmaAba(a, aba)) ?? abas[0] ?? { kind: "classificacao" };

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Rodadas totais por categoria, pra nomear "Semifinal"/"Final".
  const roundsByCat = useMemo(() => {
    const m = new Map<string, number>();
    categories.forEach((c) => {
      const rounds = matches
        .filter((x) => x.category_id === c.id && x.stage === "bracket")
        .map((x) => x.round ?? 0);
      m.set(c.id, rounds.length ? Math.max(...rounds) + 1 : 0);
    });
    return m;
  }, [categories, matches]);

  const rotulo = useCallback(
    (m: PublicMatch): string => {
      if (m.stage === "group") return groupById.get(m.group_id ?? "")?.name ?? "Grupo";
      if (m.stage === "bracket") return knockoutRoundLabel(m.round ?? 0, roundsByCat.get(m.category_id) ?? 0);
      if (m.round !== null) return `Rodada ${m.round + 1}`;
      return "";
    },
    [groupById, roundsByCat],
  );

  const jogosDaAba =
    abaAtual.kind === "classificacao" || abaAtual.kind === "mata-mata"
      ? []
      : matches
          .filter((m) => (abaAtual.kind === "sem-quadra" ? !m.court : m.court === abaAtual.court))
          .sort(byTime);

  return (
    <div className="pub">
      <div className="pub-head">
        <h1>{tournament.name}</h1>
        <div className="meta">
          {courts.length === 1 ? "1 quadra" : `${courts.length} quadras`}
          {tournament.start_time ? ` · início ${formatTime(tournament.start_time)}` : ""} ·{" "}
          <span className={`pub-live ${live ? "" : "off"}`}>
            <span className="status-dot" />
            {live ? "ao vivo" : "reconectando…"}
          </span>
        </div>
      </div>

      <div className="pub-tabs glass" role="tablist" aria-label="Seções do torneio">
        {abas.map((a) => (
          <button
            key={chaveAba(a)}
            role="tab"
            type="button"
            aria-selected={mesmaAba(a, abaAtual)}
            className="pub-tab"
            onClick={() => setAba(a)}
          >
            {rotuloAba(a)}
          </button>
        ))}
      </div>

      {abaAtual.kind === "classificacao" ? (
        <Classificacao categories={categories} groups={groups} matches={matches} />
      ) : abaAtual.kind === "mata-mata" ? (
        <MataMata categories={categories} groups={groups} matches={matches} />
      ) : jogosDaAba.length === 0 ? (
        <div className="empty glass">Nenhum jogo nesta quadra ainda.</div>
      ) : (
        jogosDaAba.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            rotulo={rotulo(m)}
            categoria={categories.length > 1 ? catById.get(m.category_id)?.name : undefined}
          />
        ))
      )}

      <p className="pub-foot">
        Atualiza sozinho conforme os placares são lançados.
        <br />
        Não precisa recarregar a página.
      </p>
    </div>
  );
}

function MatchCard({
  match,
  rotulo,
  categoria,
}: {
  match: PublicMatch;
  rotulo: string;
  categoria?: string;
}) {
  const status = matchStatus(match);
  const sets = (match.sets ?? []).filter((s) => s.a !== null && s.b !== null);

  return (
    <div className={`match glass ${status === "andamento" ? "is-live" : ""}`}>
      <div className="pub-match-top">
        <span className="pub-time">{formatTime(match.scheduled_time)}</span>
        {rotulo && <span className="badge">{rotulo}</span>}
        {categoria && <span className="badge">{categoria}</span>}
        {status === "andamento" && (
          <span className="badge live">
            <span className="status-dot" />
            Ao vivo
          </span>
        )}
        {status === "finalizado" && <span className="badge done">Fim</span>}
      </div>

      <TeamRow
        team={match.team_a}
        games={sets.map((s) => s.a)}
        contra={sets.map((s) => s.b)}
        venceu={match.winner_side === "A"}
      />
      <TeamRow
        team={match.team_b}
        games={sets.map((s) => s.b)}
        contra={sets.map((s) => s.a)}
        venceu={match.winner_side === "B"}
      />
    </div>
  );
}

function TeamRow({
  team,
  games,
  contra,
  venceu,
}: {
  team: MatchTeam;
  games: (number | null)[];
  contra: (number | null)[];
  venceu: boolean;
}) {
  return (
    <div className="pub-row">
      <div className={`pub-team ${venceu ? "win" : ""} ${team?.bye ? "bye" : ""}`}>{teamLabel(team)}</div>
      {games.length > 0 ? (
        <div className="pub-sets">
          {games.map((g, i) => (
            <span key={i} className={`pub-set ${(g ?? 0) > (contra[i] ?? 0) ? "win" : ""}`}>
              {g}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Classificacao({
  categories,
  groups,
  matches,
}: {
  categories: PublicCategory[];
  groups: PublicGroup[];
  matches: PublicMatch[];
}) {
  const comGrupos = categories.filter((c) => groups.some((g) => g.category_id === c.id));

  if (comGrupos.length === 0) {
    return <div className="empty glass">Este torneio não tem fase de grupos.</div>;
  }

  return (
    <>
      {comGrupos.map((cat) => {
        const catGroups = groups
          .filter((g) => g.category_id === cat.id)
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        return (
          <div key={cat.id}>
            {categories.length > 1 && <div className="pub-group">{cat.name}</div>}
            <Classificados cat={cat} groups={catGroups} matches={matches} />
            {catGroups.map((g) => {
              const gm = matches.filter((m) => m.group_id === g.id);
              const rows = computeGroupStandings(
                gm.map((m) => ({
                  teamA: m.team_a,
                  teamB: m.team_b,
                  sets: m.sets,
                  completed: m.completed,
                  winnerSide: m.winner_side,
                })),
              );
              const feitos = gm.filter((m) => m.completed).length;
              return (
                <div key={g.id}>
                  <div className="pub-group">
                    {g.name}{" "}
                    <span style={{ fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 400 }}>
                      {feitos}/{gm.length} jogos
                    </span>
                  </div>
                  <div className="panel glass" style={{ padding: "4px 12px" }}>
                    <StandingsTable rows={rows} highlight={cat.format === "grupos" ? QUALIFIERS_PER_GROUP : 0} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <p className="pub-foot" style={{ textAlign: "left", marginTop: 16 }}>
        J = jogos · V = vitórias · SS = saldo de sets · SG = saldo de games.
        <br />
        Desempate nessa ordem; persistindo, confronto direto.
      </p>
    </>
  );
}

/**
 * Quem passou de fase. Aparece assim que o mata-mata é gerado — antes
 * disso a classificação ainda pode virar, e cravar "classificado" com
 * jogo por disputar seria mentira.
 *
 * A ordem é a mesma que gerou o chaveamento (computeGroupStandings), então
 * o 1º e o 2º aqui são exatamente os que o cruzamento usou.
 */
function Classificados({
  cat,
  groups,
  matches,
}: {
  cat: PublicCategory;
  groups: PublicGroup[];
  matches: PublicMatch[];
}) {
  const temMataMata = matches.some((m) => m.category_id === cat.id && m.stage === "bracket");
  if (!temMataMata || cat.format !== "grupos") return null;

  const porGrupo = groups.map((g) => {
    const gm = matches.filter((m) => m.group_id === g.id);
    const rows = computeGroupStandings(
      gm.map((m) => ({
        teamA: m.team_a,
        teamB: m.team_b,
        sets: m.sets,
        completed: m.completed,
        winnerSide: m.winner_side,
      })),
    );
    return { grupo: g.name, times: rows.slice(0, QUALIFIERS_PER_GROUP) };
  });

  if (porGrupo.every((g) => g.times.length === 0)) return null;

  return (
    <div className="pub-qualificados panel glass">
      <div className="pub-qualificados-titulo">
        <span className="badge done">Classificados</span>
        <span>Avançaram para o mata-mata</span>
      </div>
      <div className="pub-qualificados-grade">
        {porGrupo.map((g) => (
          <div key={g.grupo} className="pub-qualificados-grupo">
            <div className="rotulo">{g.grupo}</div>
            <ol>
              {g.times.map((t, i) => (
                <li key={t.entryId}>
                  <span className="pos">{i + 1}º</span> {t.name}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Chaveamento: todos os jogos de mata-mata juntos, em ordem de rodada,
 * independente da quadra em que caíram.
 *
 * Empilhado na vertical de propósito. Chave desenhada em colunas só cabe
 * numa tela larga, e amanhã isso vai ser lido em 390px — com scroll
 * lateral ninguém acompanha nada. Cada jogo diz de onde vêm os dois
 * lados, então a chave se lê de cima pra baixo mesmo antes de qualquer
 * resultado sair.
 */
function MataMata({
  categories,
  groups,
  matches,
}: {
  categories: PublicCategory[];
  groups: PublicGroup[];
  matches: PublicMatch[];
}) {
  const comChave = categories.filter((c) =>
    matches.some((m) => m.category_id === c.id && m.stage === "bracket"),
  );

  if (comChave.length === 0) {
    return <div className="empty glass">O mata-mata ainda não começou.</div>;
  }

  return (
    <>
      {comChave.map((cat) => {
        const chave = matches
          .filter((m) => m.category_id === cat.id && m.stage === "bracket")
          .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0));

        const totalRodadas = Math.max(...chave.map((m) => m.round ?? 0)) + 1;
        const nomesGrupos = groups.filter((g) => g.category_id === cat.id).map((g) => g.name);
        const origens = firstRoundOrigins(nomesGrupos, QUALIFIERS_PER_GROUP);

        // Numeração por rodada ("Jogo 1"), pra poder dizer de onde vem
        // quem ainda não foi definido.
        const numeroNaRodada = new Map<string, number>();
        for (let r = 0; r < totalRodadas; r++) {
          chave
            .filter((m) => (m.round ?? 0) === r)
            .forEach((m, i) => numeroNaRodada.set(m.id, i + 1));
        }

        const origemDoLado = (m: PublicMatch, lado: "A" | "B"): string => {
          const round = m.round ?? 0;
          const slot = m.bracket_slot ?? 0;
          if (round === 0) {
            const par = origens[slot];
            if (!par) return "";
            return lado === "A" ? par[0] : par[1];
          }
          // Round r slot s é alimentado pelos slots 2s e 2s+1 da anterior.
          const alimentador = chave.find(
            (x) => (x.round ?? 0) === round - 1 && (x.bracket_slot ?? 0) === slot * 2 + (lado === "A" ? 0 : 1),
          );
          const num = alimentador ? numeroNaRodada.get(alimentador.id) : undefined;
          const rodadaAnterior = knockoutRoundLabel(round - 1, totalRodadas);
          return num ? `Vencedor do jogo ${num} (${rodadaAnterior.toLowerCase()})` : "A definir";
        };

        const rodadas = Array.from({ length: totalRodadas }, (_, r) =>
          chave.filter((m) => (m.round ?? 0) === r),
        );

        return (
          <div key={cat.id}>
            {categories.length > 1 && <div className="pub-group">{cat.name}</div>}
            {rodadas.map((jogos, r) => (
              <div key={r} className="pub-rodada">
                <div className="pub-rodada-titulo">
                  {knockoutRoundLabel(r, totalRodadas)}
                  <span className="conta">
                    {jogos.filter((m) => m.completed).length}/{jogos.length}
                  </span>
                </div>
                {jogos.map((m) => (
                  <ChaveCard
                    key={m.id}
                    match={m}
                    numero={numeroNaRodada.get(m.id) ?? 0}
                    origemA={origemDoLado(m, "A")}
                    origemB={origemDoLado(m, "B")}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function ChaveCard({
  match,
  numero,
  origemA,
  origemB,
}: {
  match: PublicMatch;
  numero: number;
  origemA: string;
  origemB: string;
}) {
  const status = matchStatus(match);
  const sets = (match.sets ?? []).filter((s) => s.a !== null && s.b !== null);

  return (
    <div className={`match glass pub-chave ${status === "andamento" ? "is-live" : ""}`}>
      <div className="pub-match-top">
        <span className="pub-chave-num">Jogo {numero}</span>
        <span className="pub-time">{formatTime(match.scheduled_time)}</span>
        {match.court && <span className="badge">{match.court}</span>}
        {status === "andamento" && (
          <span className="badge live">
            <span className="status-dot" />
            Ao vivo
          </span>
        )}
        {status === "finalizado" && <span className="badge done">Fim</span>}
      </div>

      <ChaveLado
        team={match.team_a}
        origem={origemA}
        games={sets.map((s) => s.a)}
        contra={sets.map((s) => s.b)}
        venceu={match.winner_side === "A"}
      />
      <ChaveLado
        team={match.team_b}
        origem={origemB}
        games={sets.map((s) => s.b)}
        contra={sets.map((s) => s.a)}
        venceu={match.winner_side === "B"}
      />
    </div>
  );
}

function ChaveLado({
  team,
  origem,
  games,
  contra,
  venceu,
}: {
  team: MatchTeam;
  origem: string;
  games: (number | null)[];
  contra: (number | null)[];
  venceu: boolean;
}) {
  const definido = !!team && !team.bye;

  return (
    <div className="pub-row">
      <div className="pub-chave-lado">
        <div className={`pub-team ${venceu ? "win" : ""} ${definido ? "" : "indefinido"}`}>
          {definido ? teamLabel(team) : "A definir"}
        </div>
        {origem && <div className="pub-chave-origem">{origem}</div>}
      </div>
      {games.length > 0 ? (
        <div className="pub-sets">
          {games.map((g, i) => (
            <span key={i} className={`pub-set ${(g ?? 0) > (contra[i] ?? 0) ? "win" : ""}`}>
              {g}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
