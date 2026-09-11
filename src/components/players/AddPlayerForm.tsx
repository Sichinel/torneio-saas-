"use client";

import { useActionState } from "react";
import { createPlayer } from "@/lib/players/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

export function AddPlayerForm() {
  const [state, action, pending] = useActionState(createPlayer, undefined);
  useActionFeedback(state);

  return (
    <form action={action} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
        <label>Nome</label>
        <input type="text" name="name" required />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Lado</label>
        <select name="side" defaultValue="">
          <option value="">Sem preferência</option>
          <option value="direita">Direita</option>
          <option value="esquerda">Esquerda</option>
          <option value="ambos">Ambos</option>
        </select>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Telefone</label>
        <input type="text" name="phone" placeholder="(opcional)" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Adicionando…" : "Adicionar"}
      </button>
      {state && !state.ok && (
        <p style={{ color: "var(--danger)", fontSize: 13.5, width: "100%", margin: 0 }}>{state.error}</p>
      )}
    </form>
  );
}
