"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CategoryDraft, newCategoryDraft } from "@/lib/wizard/types";
import { CategoryCard } from "./CategoryCard";
import { useToast } from "@/components/toast/ToastProvider";
import { createTournament } from "@/lib/tournaments/actions";

export function NewTournamentWizard() {
  const router = useRouter();
  const showToast = useToast();
  const [name, setName] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [startTime, setStartTime] = useState("09:00");
  const [categories, setCategories] = useState<CategoryDraft[]>([newCategoryDraft(0)]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function updateCategory(key: string, patch: Partial<CategoryDraft>) {
    setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function addCategory() {
    setCategories((prev) => [...prev, newCategoryDraft(prev.length)]);
  }
  function removeCategory(key: string) {
    setCategories((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // guarda síncrona: evita duplo envio (Enter num campo + clique, duplo
    // clique, etc.) — o estado `submitting` só reflete no DOM no próximo
    // render, o que não é rápido o suficiente pra bloquear um segundo
    // disparo do evento na mesma tick.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await createTournament({ name, numCourts, startTime, categories });
      if (result.ok) {
        showToast(result.message ?? "Torneio criado!", "success");
        router.push("/dashboard");
        return;
      }
      showToast(result.error, "error");
    } catch {
      showToast("Erro inesperado ao criar o torneio.", "error");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="panel glass-strong">
        <div className="field">
          <label>Nome do torneio</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Open de Verão 2026"
            required
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>Número de quadras</label>
            <input
              type="number"
              min={1}
              max={12}
              value={numCourts}
              onChange={(e) => setNumCourts(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label>Horário de início</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Categorias</h2>
        <button className="btn btn-ghost btn-sm" type="button" onClick={addCategory}>
          + Adicionar categoria
        </button>
      </div>

      {categories.map((draft, i) => (
        <CategoryCard
          key={draft.key}
          draft={draft}
          index={i}
          canRemove={categories.length > 1}
          onChange={(patch) => updateCategory(draft.key, patch)}
          onRemove={() => removeCategory(draft.key)}
        />
      ))}

      <div className="actions-row">
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/dashboard")} disabled={submitting}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Sorteando…" : "Criar e sortear"}
        </button>
      </div>
    </form>
  );
}
