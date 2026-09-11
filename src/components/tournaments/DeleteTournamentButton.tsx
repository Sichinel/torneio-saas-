"use client";

import { useActionState, useState } from "react";
import { deleteTournament } from "@/lib/tournaments/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

export function DeleteTournamentButton({ tournamentId }: { tournamentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteTournament.bind(null, tournamentId), undefined);

  // No sucesso, a action redireciona pra /dashboard no servidor (redirect()
  // dentro da server action) — o navegador já sai desta página antes do
  // estado "ok" voltar pro cliente. Só erro chega aqui pra dar feedback.
  useActionFeedback(state);

  if (!confirming) {
    return (
      <button className="btn btn-danger btn-sm" type="button" onClick={() => setConfirming(true)}>
        Excluir torneio
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
        Isso apaga categorias, duplas, grupos e partidas do torneio. Não dá pra desfazer.
      </span>
      <form action={action}>
        <button className="btn btn-danger btn-sm" type="submit" disabled={pending}>
          {pending ? "Excluindo…" : "Sim, excluir"}
        </button>
      </form>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirming(false)} disabled={pending}>
        Cancelar
      </button>
    </div>
  );
}
