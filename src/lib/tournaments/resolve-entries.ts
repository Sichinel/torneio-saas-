import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName, parsePlayerLine, type PlayerSide } from "@/lib/players/match";
import { updatePlayerSides } from "@/lib/players/update-sides";

export type PlayerRow = { id: string; name: string; side: string | null };

/**
 * Resolve uma lista de nomes colados contra o banco de jogadores do
 * organizador: reaproveita quem já existe (por nome normalizado, sem o
 * sufixo de lado; se a linha trouxer um lado, ele substitui o do banco)
 * e cria os que faltam já com o lado separado. Deduplica
 * nomes repetidos dentro da própria lista antes de inserir, pra não
 * violar a constraint de nome único. O Map devolvido é indexado pela
 * linha original.
 */
export async function resolvePlayersFromLines(
  supabase: SupabaseClient,
  ownerId: string,
  lines: string[],
  existingPlayers: PlayerRow[],
): Promise<Map<string, PlayerRow>> {
  const byNormalized = new Map(existingPlayers.map((p) => [normalizeName(p.name), p]));
  const keyByLine = new Map<string, string>();

  const newPlayers = new Map<string, { name: string; side: PlayerSide | null }>();
  const sideChanges = new Map<string, { id: string; side: PlayerSide }>();
  lines.forEach((line) => {
    const parsed = parsePlayerLine(line);
    const key = normalizeName(parsed.name);
    keyByLine.set(line, key);
    const existing = byNormalized.get(key);
    if (!existing) {
      if (!newPlayers.has(key)) newPlayers.set(key, parsed);
    } else if (parsed.side && parsed.side !== existing.side && !sideChanges.has(key)) {
      sideChanges.set(key, { id: existing.id, side: parsed.side });
    }
  });

  if (sideChanges.size > 0) {
    const error = await updatePlayerSides(supabase, [...sideChanges.values()]);
    if (error) throw new Error(`Não foi possível atualizar o lado dos jogadores: ${error}`);
    sideChanges.forEach(({ side }, key) => byNormalized.set(key, { ...byNormalized.get(key)!, side }));
  }

  if (newPlayers.size > 0) {
    const toInsert = [...newPlayers.values()];
    const { data, error } = await supabase
      .from("players")
      .insert(toInsert.map((p) => ({ owner_id: ownerId, name: p.name, side: p.side })))
      .select("id, name, side");
    if (error) throw new Error(`Não foi possível cadastrar jogadores novos: ${error.message}`);
    (data ?? []).forEach((row) => byNormalized.set(normalizeName(row.name), row));
  }

  const result = new Map<string, PlayerRow>();
  lines.forEach((line) => {
    const row = byNormalized.get(keyByLine.get(line)!);
    if (row) result.set(line, row);
  });
  return result;
}
