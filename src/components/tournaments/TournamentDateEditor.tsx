"use client";

import { useActionState, useState } from "react";
import { updateTournamentDate } from "@/lib/tournaments/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

/** "2026-09-11" → "sex, 11/09/2026". Sem Date(): "2026-09-11" sozinho é
 *  interpretado como UTC e vira o dia anterior em fuso negativo. */
export function formatarData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const d = new Date(ano, mes - 1, dia);
  const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

export function TournamentDateEditor({
  tournamentId,
  eventDate,
}: {
  tournamentId: string;
  eventDate: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [ultimoVisto, setUltimoVisto] = useState<unknown>(undefined);
  const [state, action, pending] = useActionState(updateTournamentDate.bind(null, tournamentId), undefined);
  useActionFeedback(state);

  // Fecha quando o servidor confirma. A comparação com `ultimoVisto` é o
  // que impede de fechar sozinho toda vez que o formulário for reaberto:
  // sem ela, o `ok` da gravação anterior continuaria valendo para sempre.
  if (state?.ok && state !== ultimoVisto) {
    setUltimoVisto(state);
    setEditando(false);
  }

  const legivel = formatarData(eventDate);

  if (!editando) {
    return (
      <span className="data-torneio">
        {legivel ? (
          <span className="valor">{legivel}</span>
        ) : (
          <span className="vazio">sem data</span>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(true)}>
          {legivel ? "Mudar data" : "Definir data"}
        </button>
      </span>
    );
  }

  return (
    <form action={action} className="data-torneio">
      <input type="date" name="event_date" defaultValue={eventDate ?? ""} aria-label="Data do torneio" />
      <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(false)} disabled={pending}>
        Cancelar
      </button>
      <span className="hint" style={{ margin: 0 }}>
        Só informativo — não muda os horários dos jogos.
      </span>
    </form>
  );
}
