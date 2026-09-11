import { NewTournamentWizard } from "@/components/wizard/NewTournamentWizard";

export const metadata = { title: "Novo torneio — Torneio" };

export default function NewTournamentPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
      </div>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Novo torneio</h1>
      <NewTournamentWizard />
    </div>
  );
}
