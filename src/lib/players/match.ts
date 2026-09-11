export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type PlayerSide = "direita" | "esquerda" | "ambos";

const SIDE_TOKENS: Record<string, PlayerSide> = {
  direita: "direita",
  dir: "direita",
  d: "direita",
  esquerda: "esquerda",
  esq: "esquerda",
  e: "esquerda",
  ambos: "ambos",
  ambas: "ambos",
};

const SIDE_SUFFIX = new RegExp(`^(.+?)[\\s,\\-–(]+(${Object.keys(SIDE_TOKENS).join("|")})\\)?$`, "i");

const LOWERCASE_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * Padroniza a capitalização de um nome novo: "FELIPE" e "felipe" viram
 * "Felipe", "maria da silva" vira "Maria da Silva". Maiúscula depois de
 * espaço, hífen, apóstrofo e ponto ("ana-luiza" → "Ana-Luiza",
 * "l. felipe" → "L. Felipe"). Só usado na criação — edição manual
 * respeita o que o organizador digitou, pra permitir exceções ("JP").
 */
export function formatPlayerName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, i) =>
      i > 0 && LOWERCASE_PARTICLES.has(word)
        ? word
        : word.replace(/(^|[-'.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("pt-BR")),
    )
    .join(" ");
}

/**
 * Separa o lado digitado junto do nome ("Alex - esquerda", "bruno d",
 * "Ana (dir)") pra ele ir pra coluna `side` em vez de ficar no nome, e
 * padroniza a capitalização do nome. Linha sem sufixo de lado
 * reconhecível volta inteira como nome.
 */
export function parsePlayerLine(line: string): { name: string; side: PlayerSide | null } {
  const trimmed = line.trim().replace(/\s+/g, " ");
  const m = trimmed.match(SIDE_SUFFIX);
  if (!m) return { name: formatPlayerName(trimmed), side: null };
  return { name: formatPlayerName(m[1]), side: SIDE_TOKENS[m[2].toLowerCase()] };
}

export function isPlayerSide(value: unknown): value is PlayerSide {
  return value === "direita" || value === "esquerda" || value === "ambos";
}

export type PlayerLite = { id: string; name: string; side: string | null };

export type PasteMatch = {
  raw: string;
  name: string;
  side: PlayerSide | null;
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
    const { name, side } = parsePlayerLine(line);
    const match = byNormalized.get(normalizeName(name));
    return {
      raw: line,
      name,
      side,
      matchedPlayerId: match?.id ?? null,
      matchedName: match?.name ?? null,
      matchedSide: match?.side ?? null,
    };
  });
}
