import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Entrar — Torneio" };

/** Motivos pelos quais /auth/confirm devolve o usuário pra cá. */
const ERROS: Record<string, string> = {
  "link-invalido": "Esse link de recuperação não é válido. Peça um novo abaixo.",
  "link-expirado": "Esse link expirou ou já foi usado. Peça um novo abaixo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const aviso = erro ? ERROS[erro] : undefined;

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
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>Entrar</h1>
        {aviso && (
          <p
            style={{
              color: "var(--danger)",
              fontSize: 13.5,
              lineHeight: 1.5,
              marginTop: -8,
              marginBottom: 18,
            }}
          >
            {aviso}
          </p>
        )}
        <LoginForm />
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 18, textAlign: "center" }}>
          Ainda não tem conta?{" "}
          <Link href="/signup" style={{ color: "var(--accent-deep)", fontWeight: 600 }}>
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
