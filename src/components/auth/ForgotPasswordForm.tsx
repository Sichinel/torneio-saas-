"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  useActionFeedback(state);

  // Depois de enviar, some com o formulário: reenviar em sequência só
  // gera mais emails e mais confusão sobre qual link ainda vale.
  if (state?.ok) {
    return (
      <p style={{ color: "var(--success)", fontSize: 14, lineHeight: 1.55 }}>
        {state.message}
        <br />
        <span style={{ color: "var(--ink-soft)" }}>
          O link vale por 1 hora. Não esqueça de olhar o spam.
        </span>
      </p>
    );
  }

  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <div className="hint">Enviaremos um link para você criar uma senha nova.</div>
      </div>
      {state && !state.ok && (
        <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: -8, marginBottom: 18 }}>
          {state.error}
        </p>
      )}
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
