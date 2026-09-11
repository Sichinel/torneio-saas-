"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  useActionFeedback(state);

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state && !state.ok && (
        <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: -8, marginBottom: 18 }}>
          {state.error}
        </p>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
