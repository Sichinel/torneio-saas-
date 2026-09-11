"use client";

import { useState, useTransition } from "react";
import { matchPastedNames, normalizeName, type PasteMatch, type PlayerLite } from "@/lib/players/match";
import { savePastedPlayers } from "@/lib/players/actions";
import { useToast } from "@/components/toast/ToastProvider";

/**
 * O que salvar a partir da análise: jogadores novos (deduplicados —
 * "augusto E" e "Augusto - esquerda" na mesma lista viram um só) e
 * lados colados que diferem do lado salvo no banco. Em repetição,
 * vale a primeira linha.
 */
function pendingSaves(results: PasteMatch[]) {
  const newPlayers = new Map<string, { name: string; side: string | null }>();
  const sideChanges = new Map<string, { id: string; side: string }>();
  results.forEach((r) => {
    if (!r.matchedPlayerId) {
      const key = normalizeName(r.name);
      if (!newPlayers.has(key)) newPlayers.set(key, { name: r.name, side: r.side });
    } else if (r.side && r.side !== r.matchedSide && !sideChanges.has(r.matchedPlayerId)) {
      sideChanges.set(r.matchedPlayerId, { id: r.matchedPlayerId, side: r.side });
    }
  });
  return { newPlayers: [...newPlayers.values()], sideChanges: [...sideChanges.values()] };
}

export function PasteRecognize({ players }: { players: PlayerLite[] }) {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<PasteMatch[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  const pending = results ? pendingSaves(results) : null;

  function analyze() {
    setResults(matchPastedNames(raw, players));
  }

  function save() {
    if (!pending) return;
    startTransition(async () => {
      const result = await savePastedPlayers(pending.newPlayers, pending.sideChanges);
      if (result.ok) {
        showToast(result.message ?? "Jogadores salvos.", "success");
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

      {results && pending && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {results.map((r, i) => (
              <span
                key={i}
                className="badge"
                style={r.matchedPlayerId ? { background: "var(--success-soft)", color: "var(--success)" } : undefined}
              >
                {!r.matchedPlayerId
                  ? `${r.name} · novo (${r.side ?? "sem lado"})`
                  : r.side && r.side !== r.matchedSide
                    ? `${r.matchedName} · já cadastrado (${r.matchedSide ?? "sem lado"} → ${r.side})`
                    : `${r.matchedName} · já cadastrado (${r.matchedSide ?? "sem lado"})`}
              </span>
            ))}
          </div>
          {(pending.newPlayers.length > 0 || pending.sideChanges.length > 0) && (
            <button className="btn btn-primary btn-sm" type="button" onClick={save} disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar no banco"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
