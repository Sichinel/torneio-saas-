"use client";

import { useActionState, useEffect, useState } from "react";
import { deletePlayer, updatePlayer } from "@/lib/players/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

type Player = { id: string; name: string; side: string | null; phone: string | null };

const rowStyle = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
  padding: "10px 0",
  borderBottom: "1px solid var(--line)",
};

export function PlayerRow({ player }: { player: Player }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updatePlayer.bind(null, player.id), undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePlayer.bind(null, player.id), undefined);

  useActionFeedback(updateState);
  useActionFeedback(deleteState);

  useEffect(() => {
    if (updateState?.ok) setEditing(false);
  }, [updateState]);

  if (editing) {
    return (
      <form action={updateAction} style={rowStyle}>
        <input type="text" name="name" defaultValue={player.name} style={{ flex: 1, minWidth: 140 }} required />
        <select name="side" defaultValue={player.side ?? ""}>
          <option value="">Sem preferência</option>
          <option value="direita">Direita</option>
          <option value="esquerda">Esquerda</option>
          <option value="ambos">Ambos</option>
        </select>
        <input type="text" name="phone" defaultValue={player.phone ?? ""} placeholder="Telefone (opcional)" />
        <button className="btn btn-primary btn-sm" type="submit" disabled={updatePending}>
          {updatePending ? "Salvando…" : "Salvar"}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div style={rowStyle}>
      <div style={{ flex: 1, fontWeight: 600 }}>{player.name}</div>
      <span className="badge">{player.side ?? "sem lado"}</span>
      {player.phone && <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{player.phone}</span>}
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(true)}>
        Editar
      </button>
      <form action={deleteAction}>
        <button className="btn btn-danger btn-sm" type="submit" disabled={deletePending}>
          {deletePending ? "Excluindo…" : "Excluir"}
        </button>
      </form>
    </div>
  );
}
