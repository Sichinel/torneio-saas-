"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CategoryDraft, newCategoryDraft } from "@/lib/wizard/types";
import { CategoryCard } from "./CategoryCard";

export function NewTournamentWizard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [numCourts, setNumCourts] = useState(2);
  const [startTime, setStartTime] = useState("09:00");
  const [categories, setCategories] = useState<CategoryDraft[]>([newCategoryDraft(0)]);
  const [notice, setNotice] = useState<string | null>(null);

  function updateCategory(key: string, patch: Partial<CategoryDraft>) {
    setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function addCategory() {
    setCategories((prev) => [...prev, newCategoryDraft(prev.length)]);
  }
  function removeCategory(key: string) {
    setCategories((prev) => prev.filter((c) => c.key !== key));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice("Sorteio e salvamento chegam no próximo passo — por enquanto isso só valida o formulário.");
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

      {notice && (
        <div className="panel glass" style={{ color: "var(--accent-deep)" }}>
          {notice}
        </div>
      )}

      <div className="actions-row">
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/dashboard")}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="submit">
          Criar e sortear
        </button>
      </div>
    </form>
  );
}
