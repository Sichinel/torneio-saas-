"use client";

import { useActionState } from "react";
import { signup } from "@/lib/auth/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  useActionFeedback(state);

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required autoComplete="new-password" />
        <div className="hint">Pelo menos 8 caracteres.</div>
      </div>
      {state && !state.ok && (
        <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: -8, marginBottom: 18 }}>
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p style={{ color: "var(--success)", fontSize: 13.5, marginTop: -8, marginBottom: 18 }}>
          {state.message}
        </p>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </button>
    </form>
  );
}
