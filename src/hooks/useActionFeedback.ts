"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast/ToastProvider";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Observa o retorno de uma Server Action (via useActionState) e dispara
 * um toast de sucesso/erro assim que ele muda. Use em todo formulário
 * ligado a uma action que retorne ActionResult.
 */
export function useActionFeedback(state: ActionResult | undefined, defaultSuccessMessage?: string) {
  const showToast = useToast();
  const seen = useRef<ActionResult | undefined>(undefined);

  useEffect(() => {
    if (!state || state === seen.current) return;
    seen.current = state;
    if (state.ok) {
      showToast(state.message ?? defaultSuccessMessage ?? "Feito.", "success");
    } else {
      showToast(state.error, "error");
    }
  }, [state, showToast, defaultSuccessMessage]);
}
