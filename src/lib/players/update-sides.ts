import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerSide } from "./match";

/**
 * Grava o lado colado por cima do lado salvo no banco (o lado digitado
 * na lista vale mais que o antigo). Agrupa por valor pra fazer no máximo
 * uma query por lado. Devolve a mensagem de erro, ou null se deu certo.
 */
export async function updatePlayerSides(
  supabase: SupabaseClient,
  changes: { id: string; side: PlayerSide }[],
): Promise<string | null> {
  const idsBySide = new Map<PlayerSide, string[]>();
  changes.forEach(({ id, side }) => idsBySide.set(side, [...(idsBySide.get(side) ?? []), id]));

  for (const [side, ids] of idsBySide) {
    const { error } = await supabase.from("players").update({ side }).in("id", ids);
    if (error) return error.message;
  }
  return null;
}
