import { shuffle } from "./shuffle";

export type PlayerForPairing = { id: string; name: string; side: string | null };

/**
 * Sorteio automático de duplas equilibrando lado (direita/esquerda)
 * quando possível: tenta parear um jogador de cada lado; o que sobrar
 * (mesmo lado, ou "ambos"/sem preferência) pareia entre si. Se o total
 * for ímpar, o último jogador fica sem parceiro (tratado por quem chama
 * como entrada incompleta).
 */
export function pairBalancedSides(players: PlayerForPairing[]): [PlayerForPairing, PlayerForPairing | null][] {
  const shuffled = shuffle(players);
  const right = shuffled.filter((p) => p.side === "direita");
  const left = shuffled.filter((p) => p.side === "esquerda");
  const flex = shuffled.filter((p) => p.side !== "direita" && p.side !== "esquerda");

  const pairs: [PlayerForPairing, PlayerForPairing | null][] = [];
  while (right.length && left.length) pairs.push([right.pop()!, left.pop()!]);
  while (right.length && flex.length) pairs.push([right.pop()!, flex.pop()!]);
  while (left.length && flex.length) pairs.push([left.pop()!, flex.pop()!]);

  const leftover = shuffle([...right, ...left, ...flex]);
  while (leftover.length >= 2) pairs.push([leftover.pop()!, leftover.pop()!]);
  if (leftover.length === 1) pairs.push([leftover.pop()!, null]);

  return pairs;
}
