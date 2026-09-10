"use client";

import { useEffect, useRef } from "react";

type Chip = { label: string; score?: string };

/**
 * Ilustração da quadra isométrica usada na hero. As linhas usam o truque
 * pathLength=100 para o traçado animado funcionar sem medir getTotalLength()
 * em runtime. O parallax no scroll é aplicado direto no DOM (sem re-render)
 * para não gerar jank durante o scroll.
 */
export function CourtScene({ chips }: { chips: [Chip, Chip] }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = wrapRef.current;
        if (!el) return;
        const offset = Math.min(window.scrollY * 0.12, 36);
        el.style.transform = `translateY(${offset}px)`;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-court-wrap" ref={wrapRef}>
      <div className="hero-court-panel glass-strong" />
      <svg className="hero-court-svg" viewBox="0 0 460 380" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="heroCourtGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(79,168,255,0.18)" />
            <stop offset="100%" stopColor="rgba(79,168,255,0.03)" />
          </linearGradient>
        </defs>
        <path className="hero-court-floor" d="M100,60 L300,60 L380,300 L40,300 Z" fill="url(#heroCourtGradient)" />
        <path pathLength={100} className="hero-court-line hero-court-line-outer" d="M100,60 L300,60 L380,300 L40,300 Z" />
        <path pathLength={100} className="hero-court-line hero-court-line-net" d="M70,180 L340,180" />
        <path pathLength={100} className="hero-court-line hero-court-line-service1" d="M85,120 L320,120" />
        <path pathLength={100} className="hero-court-line hero-court-line-service2" d="M55,240 L360,240" />
        <path pathLength={100} className="hero-court-line hero-court-line-center" d="M204,120 L204,240" />
      </svg>
      <div className="hero-ball-shadow" />
      <div className="hero-ball" />
      <div className="hero-chip hero-chip-1 glass">
        <span className="hero-chip-label">
          <span className="status-dot" />
          {chips[0].label}
        </span>
        {chips[0].score && <span className="hero-chip-score">{chips[0].score}</span>}
      </div>
      <div className="hero-chip hero-chip-2 glass">
        <span className="hero-chip-label">
          <span className="status-dot" />
          {chips[1].label}
        </span>
        {chips[1].score && <span className="hero-chip-score">{chips[1].score}</span>}
      </div>
    </div>
  );
}
