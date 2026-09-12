import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth/actions";
import { formatarData } from "@/components/tournaments/TournamentDateEditor";

export const metadata = { title: "Meus torneios — Torneio" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, public_code, created_at, event_date, categories(id, format)")
    .eq("organizer_id", user!.id)
    .order("created_at", { ascending: false });

  const allCategoryIds = (tournaments ?? []).flatMap((t) => t.categories?.map((c) => c.id) ?? []);
  const categoriesWithMatches = new Set<string>();
  if (allCategoryIds.length > 0) {
    const { data: matchRows } = await supabase.from("matches").select("category_id").in("category_id", allCategoryIds);
    (matchRows ?? []).forEach((m) => categoriesWithMatches.add(m.category_id));
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 20px 100px" }}>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">●</div>
          <div className="brand-name">Torneio</div>
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard/players" className="btn btn-ghost btn-sm">
            Jogadores
          </Link>
          <span className="topbar-email">{user?.email}</span>
          <form action={logout}>
            <button className="btn btn-ghost btn-sm" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>

      <div className="section-title">
        <h2>Meus torneios</h2>
        <Link href="/dashboard/new" className="btn btn-primary">
          + Novo torneio
        </Link>
      </div>

      {tournaments && tournaments.length > 0 ? (
        <div className="t-grid">
          {tournaments.map((t) => {
            const drawn = t.categories?.some((c) => categoriesWithMatches.has(c.id)) ?? false;
            return (
              <Link className="t-card glass" key={t.id} href={`/dashboard/${t.id}`}>
                <div className="t-card-name">{t.name}</div>
                <div className="t-card-meta">
                  {t.event_date ? `${formatarData(t.event_date)} · ` : ""}
                  {t.categories?.length ?? 0} categoria(s) · código{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-display)",
                      background: "rgba(79,168,255,.12)",
                      padding: "2px 7px",
                      borderRadius: 6,
                    }}
                  >
                    {t.public_code}
                  </code>
                </div>
                <span className={`status-pill ${drawn ? "andamento" : "pendente"}`}>
                  <span className="status-dot" />
                  {drawn ? "Sorteio feito" : "Sorteio pendente"}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty glass">Nenhum torneio criado ainda. Comece um agora.</div>
      )}
    </div>
  );
}
