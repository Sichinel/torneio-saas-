export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type PlayerLite = { id: string; name: string; side: string | null };

export type PasteMatch = {
  raw: string;
  matchedPlayerId: string | null;
  matchedName: string | null;
  matchedSide: string | null;
};

export function matchPastedNames(raw: string, players: PlayerLite[]): PasteMatch[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const byNormalized = new Map(players.map((p) => [normalizeName(p.name), p]));

  return lines.map((line) => {
    const match = byNormalized.get(normalizeName(line));
    return {
      raw: line,
      matchedPlayerId: match?.id ?? null,
      matchedName: match?.name ?? null,
      matchedSide: match?.side ?? null,
    };
  });
}
