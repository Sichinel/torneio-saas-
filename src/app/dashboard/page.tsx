import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";

export const metadata = { title: "Meus torneios — Torneio" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
      </div>
      <div className="panel glass">
        <p style={{ marginBottom: 16 }}>
          Logado como <strong>{user?.email}</strong>.
        </p>
        <p className="hint" style={{ marginBottom: 16 }}>
          Este é um placeholder do painel — a listagem real de &quot;Meus torneios&quot; entra no
          próximo passo.
        </p>
        <form action={logout}>
          <button className="btn btn-ghost btn-sm" type="submit">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
