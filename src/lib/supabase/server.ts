import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

type ClienteServidor = Awaited<ReturnType<typeof createClient>>;

/**
 * Usuário da sessão, resistente a falha transitória do endpoint de auth.
 *
 * O proxy.ts já chama getUser() e barra quem não tem sessão, então uma
 * página protegida que receba `user` nulo não está diante de um visitante
 * deslogado: está diante da SEGUNDA chamada ao /auth/v1/user tendo
 * falhado no mesmo request. Isso acontece de verdade — os logs do
 * Supabase registram 504 nesse endpoint 3 vezes só hoje.
 *
 * Tratar isso como "não tem usuário" custa caro nos dois sentidos: com
 * `user!.id` vira TypeError e 500 na cara do organizador; sem ele, vira
 * um logout falso no meio do torneio. Daí a repetição.
 *
 * Repete só o que adianta: erro de rede ou 5xx. Token inválido (4xx)
 * devolve null na hora — insistir não conserta e só atrasa o login.
 */
export async function usuarioAtual(supabase: ClienteServidor) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await supabase.auth.getUser();
    if (!error) return data.user;

    const status = error.status ?? 0;
    if (status >= 400 && status < 500) return null;

    console.error(`usuarioAtual: getUser falhou (tentativa ${tentativa + 1})`, error);
    await new Promise((r) => setTimeout(r, 120 * (tentativa + 1)));
  }
  return null;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component sem cookie store gravável.
            // O proxy.ts (passo 5) cuida de renovar a sessão nesse caso.
          }
        },
      },
    },
  );
}
