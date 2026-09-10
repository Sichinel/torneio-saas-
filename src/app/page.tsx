import Link from "next/link";
import { HeroWords } from "@/components/hero/HeroWords";
import { CourtScene } from "@/components/hero/CourtScene";

export default function Home() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
      </div>

      <section className="hero2">
        <div className="hero2-copy">
          <span className="hero2-eyebrow">Padel &amp; beach tennis</span>
          <h1 className="hero2-title">
            <HeroWords text="Seu torneio, sob um placar de vidro." />
          </h1>
          <p className="hero2-sub">
            Monte grupos, mata-mata, americano ou Super 8, sorteie tudo automaticamente e
            compartilhe um link — quem receber acompanha ao vivo, sem poder bagunçar nada.
          </p>
          <div className="hero2-actions">
            <Link href="/signup" className="btn btn-primary">
              Criar torneio grátis
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Já tenho conta
            </Link>
          </div>
          <div className="hero2-code">
            <input type="text" placeholder="Tenho um código: cole aqui" />
            <button className="btn btn-ghost">Abrir</button>
          </div>
        </div>
        <CourtScene
          chips={[
            { label: "Em andamento", score: "6 3 · 4 2" },
            { label: "Quadra 2" },
          ]}
        />
      </section>
    </div>
  );
}
