"use client";

import { useEffect } from "react";

/**
 * Rede da página pública. Um espectador na beira da quadra não tem o que
 * fazer com uma tela de erro, então esta tenta de novo sozinha depois de
 * 3 segundos — a falha típica aqui é uma conexão que piscou.
 *
 * O que ela NUNCA pode virar é um 404: "torneio não encontrado" faz a
 * pessoa achar que digitou o código errado e desistir.
 */
export default function PublicTournamentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("página pública: falha ao carregar", error);
    const t = setTimeout(reset, 3000);
    return () => clearTimeout(t);
  }, [error, reset]);

  return (
    <div className="pub">
      <div className="panel glass" style={{ textAlign: "center", padding: "32px 20px" }}>
        <h1 style={{ fontSize: 19, marginBottom: 10 }}>Recarregando o torneio…</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
          A conexão falhou por um instante. Estamos tentando de novo — o
          código do torneio está certo.
        </p>
        <button className="btn btn-primary" type="button" onClick={reset}>
          Tentar agora
        </button>
      </div>
    </div>
  );
}
