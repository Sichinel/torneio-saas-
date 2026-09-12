"use client";

import { useState, useTransition } from "react";
import { moveEntryToGroup } from "@/lib/tournaments/draw-actions";
import { PRECISA_CONFIRMAR } from "@/lib/actions/result";
import { useToast } from "@/components/toast/ToastProvider";

export type GrupoComDuplas = {
  id: string;
  name: string;
  duplas: { entryId: string; name: string }[];
};

/**
 * Ajuste manual dos grupos depois do sorteio: desistência de última hora,
 * categoria remontada, alguém que chegou.
 *
 * Mover muda o tamanho dos grupos, então os jogos da fase de grupos são
 * regerados — a tela avisa isso antes, porque quem está com o torneio
 * prestes a começar não pode ser surpreendido com a agenda trocada.
 */
export function GroupEditor({ categoryId, grupos }: { categoryId: string; grupos: GrupoComDuplas[] }) {
  const showToast = useToast();
  const [aberto, setAberto] = useState(false);
  const [movendo, setMovendo] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ entryId: string; grupoId: string; aviso: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function mover(entryId: string, grupoId: string, confirmado: boolean) {
    startTransition(async () => {
      try {
        const resultado = await moveEntryToGroup(categoryId, entryId, grupoId, confirmado);
        if (!resultado.ok && resultado.error.startsWith(PRECISA_CONFIRMAR)) {
          setConfirmacao({ entryId, grupoId, aviso: resultado.error.slice(PRECISA_CONFIRMAR.length) });
          return;
        }
        showToast(resultado.ok ? (resultado.message ?? "Feito.") : resultado.error, resultado.ok ? "success" : "error");
        if (resultado.ok) {
          setMovendo(null);
          setConfirmacao(null);
        }
      } catch (error) {
        console.error("GroupEditor: moveEntryToGroup falhou", error);
        showToast("Não consegui falar com o servidor. Recarregue a página e tente de novo.", "error");
      }
    });
  }

  if (grupos.length < 2) return null;

  if (!aberto) {
    return (
      <div className="edit-row" style={{ marginBottom: 18 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberto(true)}>
          Editar grupos
        </button>
        <span className="hint" style={{ margin: 0 }}>
          Mover uma dupla de grupo regera os jogos da fase de grupos.
        </span>
      </div>
    );
  }

  return (
    <div className="panel glass grupo-editor">
      <div className="section-title" style={{ marginTop: 0 }}>
        <h2 style={{ fontSize: 16 }}>Editar grupos</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAberto(false)}>
          Fechar
        </button>
      </div>

      {confirmacao && (
        <div className="conflict-banner" role="alert" style={{ marginBottom: 16 }}>
          ⚠ {confirmacao.aviso}
          <div className="edit-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={pending}
              onClick={() => mover(confirmacao.entryId, confirmacao.grupoId, true)}
            >
              {pending ? "Movendo…" : "Sim, mover e apagar"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setConfirmacao(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {grupos.map((g) => (
        <div key={g.id} className="grupo-editor-bloco">
          <div className="group-title">
            {g.name}
            <span className="count">{g.duplas.length} dupla(s)</span>
          </div>
          {g.duplas.map((d) => (
            <div key={d.entryId} className="grupo-editor-linha">
              <span className="nome">{d.name}</span>
              {movendo === d.entryId ? (
                <span className="destinos">
                  <span className="hint" style={{ margin: 0 }}>
                    mover para
                  </span>
                  {grupos
                    .filter((outro) => outro.id !== g.id)
                    .map((outro) => (
                      <button
                        key={outro.id}
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={pending}
                        onClick={() => mover(d.entryId, outro.id, false)}
                      >
                        {outro.name.replace("Grupo ", "")}
                      </button>
                    ))}
                  <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setMovendo(null)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() => {
                    setMovendo(d.entryId);
                    setConfirmacao(null);
                  }}
                >
                  Mover
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      <p className="hint" style={{ marginBottom: 0 }}>
        Os jogos da fase de grupos são regerados e reagendados a cada mudança. Placar de
        confronto que continua existindo é preservado. Não dá para mexer depois de gerar o
        mata-mata.
      </p>
    </div>
  );
}
