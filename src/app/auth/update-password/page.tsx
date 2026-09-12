import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const metadata = { title: "Nova senha — Torneio" };

export default async function UpdatePasswordPage() {
  // Quem chega aqui veio do /auth/confirm e já tem sessão de recovery.
  // Sem sessão não há o que atualizar — provavelmente link expirado ou
  // alguém abrindo a URL na mão.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?erro=link-expirado");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div className="brand" style={{ marginBottom: 28 }}>
        <div className="brand-mark">●</div>
        <div className="brand-name">Torneio</div>
      </div>
      <div className="panel glass-strong" style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Nova senha</h1>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 20 }}>
          Definindo a senha de <strong>{user.email}</strong>.
        </p>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
