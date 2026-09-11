"use client";

import { useState, useTransition } from "react";
import { saveMatchResult, saveMatchSchedule } from "@/lib/tournaments/match-actions";
import { useToast } from "@/components/toast/ToastProvider";
import type { ActionResult } from "@/lib/actions/result";
import type { MatchTeam } from "@/lib/tournament-logic/types";
import { hasAnyScore, type SetScore } from "@/lib/tournament-logic/results";
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

function teamLabel(team: MatchTeam): string {
  if (!team) return "A definir";
  if (team.bye) return "BYE";
  return team.name;
}

const toInput = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const toNumber = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * Card de partida do organizador: mostra o jogo e abre, no próprio card,
 * a edição de placar (sets) e de quadra/horário. Pensado pra ser usado
 * no celular durante o torneio — campos grandes, teclado numérico.
 */
export function MatchEditor({
  match,
  courts,
  maxSets,
  label,
}: {
  match: EditableMatch;
  courts: string[];
  maxSets: number;
  label?: string;
}) {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<{ a: string; b: string }[]>([]);
  const [court, setCourt] = useState("");
  const [time, setTime] = useState("");
  const [pending, startTransition] = useTransition();

  const status = matchStatus(match);
  const canScore = !!match.team_a && !!match.team_b && !match.team_a.bye && !match.team_b.bye;
  const setIndexes = Array.from({ length: maxSets }, (_, i) => i);

  function openEditor() {
    setSets([0, 1, 2].map((i) => ({ a: toInput(match.sets?.[i]?.a), b: toInput(match.sets?.[i]?.b) })));
    setCourt(match.court ?? "");
    setTime(match.scheduled_time ? formatTime(match.scheduled_time) : "");
    setOpen(true);
  }

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          showToast(result.message ?? "Salvo.", "success");
          setOpen(false);
        } else {
          showToast(result.error, "error");
        }
      } catch (error) {
        console.error("MatchEditor: action failed", error);
        showToast(
          "Não consegui falar com o servidor. Confira a internet; se o app acabou de ser atualizado, recarregue a página.",
          "error",
        );
      }
    });
  }

  function setScore(i: number, side: "a" | "b", value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    setSets((prev) => prev.map((s, j) => (j === i ? { ...s, [side]: digits } : s)));
  }

  const saveScore = () =>
    run(() => saveMatchResult(match.id, sets.slice(0, maxSets).map((s) => ({ a: toNumber(s.a), b: toNumber(s.b) }))));
  const clearScore = () => {
    if (window.confirm("Apagar o placar deste jogo?")) run(() => saveMatchResult(match.id, []));
  };
  const saveSchedule = () => run(() => saveMatchSchedule(match.id, court || null, time || null));

  return (
    <div className={`match glass ${status === "andamento" ? "is-live" : ""}`}>
      <div className="match-top">
        <div className="tags">
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

      {!open ? (
        <div className="edit-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={openEditor}>
            {canScore ? "Editar placar / horário" : "Editar horário"}
          </button>
        </div>
      ) : (
        <>
          {canScore && (
            <>
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
                        value={sets[i]?.[side] ?? ""}
                        onChange={(e) => setScore(i, side, e.target.value)}
                        disabled={pending}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="edit-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={saveScore} disabled={pending}>
                  {pending ? "Salvando…" : "Salvar placar"}
                </button>
                {hasAnyScore(match.sets) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clearScore} disabled={pending}>
                    Apagar placar
                  </button>
                )}
              </div>
            </>
          )}

          <div className="edit-row">
            <select value={court} onChange={(e) => setCourt(e.target.value)} disabled={pending} aria-label="Quadra">
              <option value="">Sem quadra</option>
              {courts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={pending} aria-label="Horário" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={saveSchedule} disabled={pending}>
              Salvar horário
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={pending}>
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
