"use client";

import { useState, useTransition } from "react";
import { matchPastedNames, type PlayerLite } from "@/lib/players/match";
import { createPlayersBulk } from "@/lib/players/actions";
import { useToast } from "@/components/toast/ToastProvider";

export function PasteRecognize({ players }: { players: PlayerLite[] }) {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<ReturnType<typeof matchPastedNames> | null>(null);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function analyze() {
    setResults(matchPastedNames(raw, players));
  }

  function addAllNew() {
    if (!results) return;
    const newNames = results.filter((r) => !r.matchedPlayerId).map((r) => r.raw);
    if (newNames.length === 0) return;
    startTransition(async () => {
      const result = await createPlayersBulk(newNames);
      if (result.ok) {
        showToast(result.message ?? "Jogadores adicionados.", "success");
        setResults(null);
        setRaw("");
      } else {
        showToast(result.error, "error");
      }
    });
  }

  return (
    <div className="panel glass">
      <div className="field">
        <label>Colar lista (um nome por linha)</label>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"João\nAna\nPedro"} />
      </div>
      <div className="actions-row" style={{ justifyContent: "flex-start" }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={analyze} disabled={!raw.trim()}>
          Analisar lista
        </button>
      </div>

      {results && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {results.map((r, i) => (
              <span
                key={i}
                className="badge"
                style={r.matchedPlayerId ? { background: "var(--success-soft)", color: "var(--success)" } : undefined}
              >
                {r.raw} · {r.matchedPlayerId ? `já cadastrado (${r.matchedSide ?? "sem lado"})` : "novo"}
              </span>
            ))}
          </div>
          {results.some((r) => !r.matchedPlayerId) && (
            <button className="btn btn-primary btn-sm" type="button" onClick={addAllNew} disabled={isPending}>
              {isPending ? "Adicionando…" : "Adicionar novos ao banco"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
