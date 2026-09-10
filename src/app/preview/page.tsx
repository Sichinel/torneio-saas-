import { HeroWords } from "@/components/hero/HeroWords";
import { CourtScene } from "@/components/hero/CourtScene";

export const metadata = {
  title: "Preview do design system — Torneio",
};

export default function PreviewPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
        <div className="topbar-actions">
          <button className="help-btn" title="Como funciona">
            ?
          </button>
        </div>
      </div>

      <div className="section-title">
        <h2>Hero — home (/) [componente real, usado na página]</h2>
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
            <button className="btn btn-primary">Criar torneio grátis</button>
            <button className="btn btn-ghost">Já tenho conta</button>
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

      <div className="section-title">
        <h2>Hero — header do torneio (prévia; /t/[código] ainda não existe)</h2>
      </div>
      <section className="hero2" style={{ padding: "12px 0 32px" }}>
        <div className="hero2-copy">
          <span className="hero2-eyebrow">Fase de grupos · 16 duplas</span>
          <h1 className="hero2-title" style={{ fontSize: "clamp(2rem, 4.2vw, 3.6rem)" }}>
            <HeroWords text="Open de Verão 2026" />
          </h1>
          <p className="hero2-sub">
            4 grupos · 4 quadras · começa às 09:00 — acompanhe ao vivo ou entre como
            organizador para lançar os placares.
          </p>
          <div className="hero2-actions">
            <button className="btn btn-ghost btn-sm">🔗 Copiar link público</button>
          </div>
        </div>
        <CourtScene
          chips={[
            { label: "Ao vivo", score: "6 3 · 4 5" },
            { label: "Quadra 3" },
          ]}
        />
      </section>

      <div className="section-title">
        <h2>Meus torneios</h2>
        <button className="btn btn-primary">+ Novo torneio</button>
      </div>
      <div className="t-grid">
        <div className="t-card glass featured">
          <div className="t-card-name">Open de Verão 2026</div>
          <div className="t-card-meta">
            Fase de grupos · código{" "}
            <code
              style={{
                fontFamily: "var(--font-display)",
                background: "rgba(79,168,255,.12)",
                padding: "2px 7px",
                borderRadius: 6,
              }}
            >
              a1b2c3
            </code>
          </div>
          <span className="status-pill andamento">
            <span className="status-dot" />
            Em andamento
          </span>
        </div>
        <div className="t-card glass">
          <div className="t-card-name">Super 8 do Clube</div>
          <div className="t-card-meta">Super 8 · código zx9k1</div>
          <span className="status-pill pendente">
            <span className="status-dot" />
            Sorteio pendente
          </span>
        </div>
      </div>

      <div className="section-title">
        <h2>Botões</h2>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary">Criar e sortear</button>
        <button className="btn btn-ghost">Sortear de novo</button>
        <button className="btn btn-danger btn-sm">Excluir torneio</button>
      </div>

      <div className="section-title">
        <h2>Navegação em abas</h2>
      </div>
      <div className="pill-nav glass">
        <div className="pill active">Grupos</div>
        <div className="pill">Partidas</div>
        <div className="pill">Classificação</div>
        <div className="pill">Chaveamento</div>
      </div>

      <div className="section-title">
        <h2>Partida (com pulso ao vivo)</h2>
      </div>
      <div className="match glass is-live">
        <div className="match-top">
          <div className="tags">
            <span className="badge">09:40</span>
            <span className="badge">Quadra 2</span>
            <span className="badge live">
              <span className="status-dot" />
              Em andamento
            </span>
          </div>
        </div>
        <div className="match-teams">
          <div className="team-name">Ana / Bia</div>
          <div className="sets-inputs">
            {[0, 1, 2].map((i) => (
              <div className="set-pair" key={i}>
                <span>set {i + 1}</span>
                <div className="pair">
                  <input className="score-input" defaultValue={i === 0 ? 6 : ""} />
                  <input className="score-input" defaultValue={i === 0 ? 3 : ""} />
                </div>
              </div>
            ))}
          </div>
          <div className="team-name" style={{ textAlign: "right" }}>
            Carla / Marina
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Classificação</h2>
      </div>
      <table className="standings">
        <thead>
          <tr>
            <th>Dupla</th>
            <th className="num">J</th>
            <th className="num">V</th>
            <th className="num">D</th>
            <th className="num">Saldo</th>
            <th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          <tr className="top">
            <td>Ana / Bia</td>
            <td className="num">3</td>
            <td className="num">3</td>
            <td className="num">0</td>
            <td className="num">+9</td>
            <td className="num">6</td>
          </tr>
          <tr>
            <td>Carla / Marina</td>
            <td className="num">3</td>
            <td className="num">1</td>
            <td className="num">2</td>
            <td className="num">-4</td>
            <td className="num">2</td>
          </tr>
        </tbody>
      </table>

      <div className="section-title">
        <h2>Link público</h2>
      </div>
      <div className="share-box glass">
        🔗 Link público — compartilhe este código para outros acompanharem:{" "}
        <code>a1b2c3</code>
        <button className="btn-sm btn btn-ghost">Copiar código</button>
      </div>
    </div>
  );
}
