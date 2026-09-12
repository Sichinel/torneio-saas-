import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, usuarioAtual } from "@/lib/supabase/server";
import { AddPlayerForm } from "@/components/players/AddPlayerForm";
import { PlayerRow } from "@/components/players/PlayerRow";
import { PasteRecognize } from "@/components/players/PasteRecognize";

export const metadata = { title: "Jogadores — Torneio" };

export default async function PlayersPage() {
  const supabase = await createClient();
  const user = await usuarioAtual(supabase);
  if (!user) redirect("/login");

  const { data: players } = await supabase
    .from("players")
    .select("id, name, side, phone")
    .eq("owner_id", user.id)
    .order("name");

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            ← Meus torneios
          </Link>
        </div>
      </div>

      <div className="section-title">
        <h2>Banco de jogadores</h2>
      </div>
      <div className="panel glass-strong">
        <AddPlayerForm />
      </div>

      <div className="section-title">
        <h2>Colar lista</h2>
      </div>
      <PasteRecognize players={players ?? []} />

      <div className="section-title">
        <h2>Todos os jogadores ({players?.length ?? 0})</h2>
      </div>
      <div className="panel glass">
        {players && players.length > 0 ? (
          players.map((p) => <PlayerRow key={p.id} player={p} />)
        ) : (
          <div className="empty">Nenhum jogador cadastrado ainda.</div>
        )}
      </div>
    </div>
  );
}
