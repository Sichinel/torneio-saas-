"use client";

import { useState, useTransition } from "react";
import { saveMatchResult, saveMatchSchedule } from "@/lib/tournaments/match-actions";
import { useToast } from "@/components/toast/ToastProvider";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import { MAX_GAMES_PER_SET, hasAnyScore, type SetScore } from "@/lib/tournament-logic/results";
import { STATUS_LABEL, formatSets, formatTime, matchStatus } from "@/lib/tournament-logic/display";

export type EditableMatch = {
  id: string;
  court: string | null;
  scheduled_time: string | null;
  team_a: MatchTeam;
  team_b: MatchTeam;
  sets: SetScore[];
  completed: boolean;
  winner_side: "A" | "B" | null;
};

type Draft = { sets: { a: string; b: string }[]; court: string; time: string };

function teamLabel(team: MatchTeam): string {
  if (!team) return "A definir";
  if (team.bye) return "BYE";
  return team.name;
}

const toInput = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const toNumber = (s: string) => (s.trim() === "" ? null : Number(s));
const SERVER_DOWN =
  "Não consegui falar com o servidor. Confira a internet; se o app acabou de ser atualizado, recarregue a página.";

/**
 * Card de partida do organizador: mostra o jogo e abre, no próprio card,
 * a edição de placar (sets), quadra e horário — com um único "Salvar"
 * que grava só o que mudou e avisa exatamente o que foi feito. Pensado
 * pra ser usado no celular durante o torneio (campos grandes, teclado
 * numérico).
 */
export function MatchEditor({
  match,
  courts,
  maxSets,
  label,
  conflicts = [],
}: {
  match: EditableMatch;
  courts: string[];
  maxSets: number;
  label?: string;
  /** frases de conflito de agenda com outros jogos (vazio = sem conflito) */
  conflicts?: string[];
}) {
  const showToast = useToast();
  const [original, setOriginal] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const status = matchStatus(match);
  const canScore = !!match.team_a && !!match.team_b && !match.team_a.bye && !match.team_b.bye;
  const setIndexes = Array.from({ length: maxSets }, (_, i) => i);

  function openEditor() {
    const initial: Draft = {
      sets: [0, 1, 2].map((i) => ({ a: toInput(match.sets?.[i]?.a), b: toInput(match.sets?.[i]?.b) })),
      court: match.court ?? "",
      time: match.scheduled_time ? formatTime(match.scheduled_time) : "",
    };
    setOriginal(initial);
    setDraft(initial);
    setInputError(null);
  }
  const close = () => {
    setOriginal(null);
    setDraft(null);
    setInputError(null);
  };

  const setsKey = (d: Draft) => JSON.stringify(d.sets.slice(0, maxSets));
  const setsDirty = !!draft && !!original && canScore && setsKey(draft) !== setsKey(original);
  const scheduleDirty = !!draft && !!original && (draft.court !== original.court || draft.time !== original.time);

  // aceita só um dígito de 0 a MAX_GAMES_PER_SET; qualquer outra coisa é recusada com aviso
  function setScore(i: number, side: "a" | "b", value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length > 1 || (digits !== "" && Number(digits) > MAX_GAMES_PER_SET)) {
      setInputError(`Cada set vai de 0 a ${MAX_GAMES_PER_SET} games.`);
      return;
    }
    setInputError(null);
    setDraft((d) => d && { ...d, sets: d.sets.map((s, j) => (j === i ? { ...s, [side]: digits } : s)) });
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      try {
        const done: string[] = [];
        if (scheduleDirty) {
          const r = await saveMatchSchedule(match.id, draft.court || null, draft.time || null);
          if (!r.ok) return showToast(r.error, "error");
          done.push(r.message ?? "Quadra e horário salvos.");
        }
        if (setsDirty) {
          const sets = draft.sets.slice(0, maxSets).map((s) => ({ a: toNumber(s.a), b: toNumber(s.b) }));
          const r = await saveMatchResult(match.id, sets);
          if (!r.ok) return showToast(done.length ? `${done.join(" ")} Mas o placar não foi salvo: ${r.error}` : r.error, "error");
          done.push(r.message ?? "Placar salvo.");
        }
        showToast(done.join(" "), "success");
        close();
      } catch (error) {
        console.error("MatchEditor: save failed", error);
        showToast(SERVER_DOWN, "error");
      }
    });
  }

  function clearScore() {
    if (!window.confirm("Apagar o placar deste jogo?")) return;
    startTransition(async () => {
      try {
        const r = await saveMatchResult(match.id, []);
        showToast(r.ok ? (r.message ?? "Placar apagado.") : r.error, r.ok ? "success" : "error");
        if (r.ok) close();
      } catch (error) {
        console.error("MatchEditor: clear failed", error);
        showToast(SERVER_DOWN, "error");
      }
    });
  }

  return (
    <div
      className={`match glass ${status === "andamento" ? "is-live" : ""} ${conflicts.length ? "has-conflict" : ""}`}
    >
      <div className="match-top">
        <div className="tags">
          {conflicts.length > 0 && <span className="badge conflict">⚠ Conflito de horário</span>}
          {label && <span className="badge">{label}</span>}
          <span className="badge">{match.court ?? "Sem quadra"}</span>
          <span className="badge">{formatTime(match.scheduled_time)}</span>
        </div>
        <span className={`badge ${status === "finalizado" ? "done" : status === "andamento" ? "live" : ""}`}>
          {status === "andamento" && <span className="status-dot" />}
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="match-teams">
        <div className={`team-name ${match.winner_side === "A" ? "winner" : ""} ${match.team_a?.bye ? "bye" : ""}`}>
          {teamLabel(match.team_a)}
        </div>
        <div className="match-score">{formatSets(match.sets) || "vs"}</div>
        <div className={`team-name ${match.winner_side === "B" ? "winner" : ""} ${match.team_b?.bye ? "bye" : ""}`}>
          {teamLabel(match.team_b)}
        </div>
      </div>

      {conflicts.length > 0 && (
        <ul className="conflict-list">
          {conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      {!draft ? (
        <div className="edit-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={openEditor}>
            {canScore ? "Editar placar, quadra ou horário" : "Editar quadra ou horário"}
          </button>
        </div>
      ) : (
        <>
          {canScore && (
            <div className="score-grid" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${maxSets}, 52px)` }}>
              <span />
              {setIndexes.map((i) => (
                <span key={i} className="score-grid-head">
                  {maxSets === 1 ? "Set" : `${i + 1}º set`}
                </span>
              ))}
              {(["a", "b"] as const).map((side) => (
                <div key={side} style={{ display: "contents" }}>
                  <span className="score-grid-team">{teamLabel(side === "a" ? match.team_a : match.team_b)}</span>
                  {setIndexes.map((i) => (
                    <input
                      key={i}
                      className="score-input lg"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      aria-label={`${i + 1}º set — ${teamLabel(side === "a" ? match.team_a : match.team_b)}`}
                      value={draft.sets[i]?.[side] ?? ""}
                      onChange={(e) => setScore(i, side, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      disabled={pending}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
          {inputError && (
            <div className="conflict-list" role="alert" style={{ listStyle: "none", paddingLeft: 0 }}>
              {inputError}
            </div>
          )}

          <div className="edit-row">
            <select
              value={draft.court}
              onChange={(e) => setDraft((d) => d && { ...d, court: e.target.value })}
              disabled={pending}
              aria-label="Quadra"
            >
              <option value="">Sem quadra</option>
              {courts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={draft.time}
              onChange={(e) => setDraft((d) => d && { ...d, time: e.target.value })}
              disabled={pending}
              aria-label="Horário"
            />
          </div>

          <div className="edit-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={pending || (!setsDirty && !scheduleDirty)}
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
            {canScore && hasAnyScore(match.sets) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearScore} disabled={pending}>
                Apagar placar
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={pending}>
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
