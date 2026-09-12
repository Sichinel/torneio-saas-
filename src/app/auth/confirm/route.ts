import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/auth/update-password";

/**
 * Só aceitamos caminho interno. Sem isso, o `next` do link de email vira
 * um open redirect: bastaria mandar next=https://site-falso.com.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

/**
 * Ponto de chegada dos links de email do Supabase (recuperação de senha e,
 * se um dia ligarmos, confirmação de cadastro). Troca o token_hash de uso
 * único por uma sessão em cookie e manda o usuário adiante.
 *
 * O template de email precisa apontar pra cá — ver Authentication > Email
 * Templates no painel.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/login?erro=link-invalido", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    // Caso normal: link já usado ou expirado (1h por padrão).
    console.error("auth/confirm: verifyOtp failed", error);
    return NextResponse.redirect(new URL("/login?erro=link-expirado", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
