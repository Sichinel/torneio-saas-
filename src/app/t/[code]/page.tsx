import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicTournamentView } from "@/components/public/PublicTournamentView";
import {
  MATCH_COLUMNS,
  type PublicCategory,
  type PublicGroup,
  type PublicMatch,
} from "@/lib/tournaments/public-data";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("name")
    .eq("public_code", code)
    .maybeSingle();

  return { title: data ? `${data.name} — ao vivo` : "Torneio não encontrado" };
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

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, courts, start_time")
    .eq("public_code", code)
    .maybeSingle();

  if (!tournament) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, format")
    .eq("tournament_id", tournament.id)
    .order("created_at");

  const categoryIds = (categories ?? []).map((c) => c.id);

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
      }}
      categories={(categories ?? []) as PublicCategory[]}
      groups={(groups ?? []) as PublicGroup[]}
      initialMatches={((matches ?? []) as PublicMatch[])}
    />
  );
}
