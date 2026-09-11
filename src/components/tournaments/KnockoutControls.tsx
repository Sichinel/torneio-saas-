"use client";

import { useState, useTransition } from "react";
import { generateKnockout, undoKnockout } from "@/lib/tournaments/match-actions";
import { useToast } from "@/components/toast/ToastProvider";
import type { ActionResult } from "@/lib/actions/result";

/**
 * Botão "Gerar mata-mata" (grupos todos finalizados, chave ainda não
 * gerada) ou "Desfazer mata-mata" (chave gerada e sem nenhum placar).
 * Ambos pedem confirmação num segundo toque.
 */
export function KnockoutControls({ categoryId, mode }: { categoryId: string; mode: "generate" | "undo" }) {
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      try {
        const result = await action();
        showToast(result.ok ? (result.message ?? "Feito.") : result.error, result.ok ? "success" : "error");
      } catch (error) {
        console.error("KnockoutControls: action failed", error);
        showToast("Não consegui falar com o servidor. Recarregue a página e tente de novo.", "error");
      } finally {
        setConfirming(false);
      }
    });
  }

  const isGenerate = mode === "generate";
  if (!confirming) {
    return (
      <button
        type="button"
        className={`btn btn-sm ${isGenerate ? "btn-primary" : "btn-ghost"}`}
        onClick={() => setConfirming(true)}
      >
        {isGenerate ? "Gerar mata-mata" : "Desfazer mata-mata"}
      </button>
    );
  }

  return (
    <div className="edit-row" style={{ marginTop: 0 }}>
      <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
        {isGenerate
          ? "Monta as quartas com os 2 melhores de cada grupo (1ºA×2ºB…) e agenda depois dos grupos. Os resultados dos grupos ficam travados."
          : "Apaga a chave do mata-mata e destrava os resultados dos grupos."}
      </span>
      <button
        type="button"
        className={`btn btn-sm ${isGenerate ? "btn-primary" : "btn-danger"}`}
        onClick={() => run(() => (isGenerate ? generateKnockout(categoryId) : undoKnockout(categoryId)))}
        disabled={pending}
      >
        {pending ? "Aguarde…" : isGenerate ? "Sim, gerar" : "Sim, desfazer"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)} disabled={pending}>
        Cancelar
      </button>
    </div>
  );
}
