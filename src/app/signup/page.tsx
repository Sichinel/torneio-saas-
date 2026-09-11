import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Criar conta — Torneio" };

export default function SignupPage() {
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
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>Criar conta</h1>
        <SignupForm />
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 18, textAlign: "center" }}>
          Já tem conta?{" "}
          <Link href="/login" style={{ color: "var(--accent-deep)", fontWeight: 600 }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
