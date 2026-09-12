"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/auth/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  useActionFeedback(state);

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" required autoComplete="new-password" />
        <div className="hint">Pelo menos 8 caracteres.</div>
      </div>
      <div className="field">
        <label htmlFor="confirmation">Repita a nova senha</label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          required
          autoComplete="new-password"
        />
      </div>
      {state && !state.ok && (
        <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: -8, marginBottom: 18 }}>
          {state.error}
        </p>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
