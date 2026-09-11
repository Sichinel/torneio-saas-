import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePlayersFromLines, type PlayerBank, type PlayerRow } from "./resolve-entries";
import { pairBalancedSides } from "@/lib/tournament-logic/pairing";
import { effectiveTeamType, type CategoryDraft } from "@/lib/wizard/types";
import type { EntryDraft } from "@/lib/tournament-logic/types";

/**
 * Transforma o texto colado da categoria em EntryDraft[]: reconhece/cria
 * jogadores no banco e, se o formato pedir duplas mas o organizador
 * digitou jogadores individuais, sorteia as duplas equilibrando lado.
 */
export async function buildEntriesForCategory(
  supabase: SupabaseClient,
  ownerId: string,
  draft: CategoryDraft,
  playerBank: PlayerBank,
): Promise<EntryDraft[]> {
  const lines = draft.participantsRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const teamType = effectiveTeamType(draft);

  if (teamType === "duplas") {
    const names: string[] = [];
    const pairsRaw: [string, string][] = [];
    const invalidLines: string[] = [];
    lines.forEach((line) => {
      const parts = line.split("/").map((s) => s.trim());
      const [a, b] = parts;
      if (parts.length === 2 && a && b) {
        names.push(a, b);
        pairsRaw.push([a, b]);
      } else {
        invalidLines.push(line);
      }
    });
    if (invalidLines.length > 0) {
      throw new Error(
        `A categoria "${draft.name}" espera uma dupla por linha no formato "Nome 1 / Nome 2". ` +
          `Não consegui interpretar: ${invalidLines.map((l) => `"${l}"`).join(", ")}.`,
      );
    }
    const resolved = await resolvePlayersFromLines(supabase, ownerId, names, playerBank);
    return pairsRaw
      .map(([a, b]) => {
        const pa = resolved.get(a);
        const pb = resolved.get(b);
        if (!pa || !pb) return null;
        return { id: crypto.randomUUID(), playerIds: [pa.id, pb.id], name: `${pa.name} / ${pb.name}` };
      })
      .filter((x): x is EntryDraft => x !== null);
  }

  // individual
  const resolved = await resolvePlayersFromLines(supabase, ownerId, lines, playerBank);
  // linhas diferentes podem resolver pro mesmo jogador ("ana d" e "Ana - direita")
  const players = [...new Map(lines.map((l) => resolved.get(l)).filter((p): p is PlayerRow => !!p).map((p) => [p.id, p])).values()];

  const isRotatingIndividual = draft.format === "super8" || (draft.format === "americano" && draft.americanoType === "rotativo");
  if (isRotatingIndividual) {
    return players.map((p) => ({ id: crypto.randomUUID(), playerIds: [p.id], name: p.name }));
  }

  // grupos/mata/americano-fixas com entrada individual: sorteia duplas equilibrando lado
  const pairs = pairBalancedSides(players);
  return pairs.map(([p1, p2]) => ({
    id: crypto.randomUUID(),
    playerIds: p2 ? [p1.id, p2.id] : [p1.id],
    name: p2 ? `${p1.name} / ${p2.name}` : `${p1.name} (sem parceiro)`,
  }));
}
