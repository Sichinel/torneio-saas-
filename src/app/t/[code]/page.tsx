import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PublicTournamentView } from "@/components/public/PublicTournamentView";
import {
  MATCH_COLUMNS,
  type PublicCategory,
  type PublicGroup,
  type PublicMatch,
} from "@/lib/tournaments/public-data";

type Props = { params: Promise<{ code: string }> };

/**
 * Busca o torneio distinguindo "não existe" de "não deu pra buscar".
 *
 * Sem isso, qualquer falha transitória vira 404: o espectador lê
 * "torneio não encontrado" e conclui que o código está errado, quando o
 * problema era uma conexão que piscou. Erro de verdade sobe como
 * exceção e cai no error.tsx, que tenta de novo sozinho.
 */
async function buscarTorneio(supabase: SupabaseClient, code: string) {
  let ultimoErro: unknown = null;

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, courts, start_time, event_date")
      .eq("public_code", code)
      .maybeSingle();

    if (!error) return { encontrado: data };

    ultimoErro = error;
    console.error(`/t/${code}: busca do torneio falhou (tentativa ${tentativa + 1})`, error);
    await new Promise((r) => setTimeout(r, 150 * (tentativa + 1)));
  }

  throw new Error(`Não foi possível carregar o torneio ${code}: ${String(ultimoErro)}`);
}

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("name")
    .eq("public_code", code)
    .maybeSingle();

  return { title: data ? `${data.name} — ao vivo` : "Torneio" };
}

/**
 * Página pública do torneio: quem tem o código vê os jogos e a
 * classificação ao vivo, sem login. Só leitura — as RLS liberam SELECT
 * anônimo em tournaments/categories/groups/matches, e os nomes das duplas
 * vêm desnormalizados em team_a/team_b, então nada aqui toca em `players`
 * (que é restrito ao dono).
 *
 * O carregamento inicial é no servidor pra abrir rápido no 4G da quadra;
 * dali em diante o componente cliente mantém tudo atualizado por Realtime.
 */
export default async function PublicTournamentPage({ params }: Props) {
  const { code } = await params;
  const supabase = await createClient();

  const { encontrado: tournament } = await buscarTorneio(supabase, code);

  // Só aqui é 404 de verdade: a busca funcionou e não existe esse código.
  if (!tournament) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, format")
    .eq("tournament_id", tournament.id)
    .order("created_at");

  const categoryIds = (categories ?? []).map((c) => c.id);

  // Sem filtro de stage: grupos e mata-mata vêm juntos, e é o cliente que
  // decide como agrupar.
  const [{ data: groups }, { data: matches }] = await Promise.all([
    categoryIds.length
      ? supabase.from("groups").select("id, category_id, name").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as PublicGroup[] }),
    categoryIds.length
      ? supabase.from("matches").select(MATCH_COLUMNS).in("category_id", categoryIds)
      : Promise.resolve({ data: [] as PublicMatch[] }),
  ]);

  return (
    <PublicTournamentView
      tournament={{
        id: tournament.id,
        name: tournament.name,
        courts: tournament.courts ?? [],
        start_time: tournament.start_time,
        event_date: tournament.event_date ?? null,
      }}
      categories={(categories ?? []) as PublicCategory[]}
      groups={(groups ?? []) as PublicGroup[]}
      initialMatches={(matches ?? []) as PublicMatch[]}
    />
  );
}
