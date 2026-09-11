export type Format = "grupos" | "mata" | "americano" | "super8";
export type TeamType = "duplas" | "individual";
export type AmericanoType = "rotativo" | "fixas";
export type SetsToWin = 1 | 2;

export type CategoryDraft = {
  key: string;
  name: string;
  format: Format;
  teamType: TeamType;
  americanoType: AmericanoType;
  setsToWin: SetsToWin;
  numGroups: number;
  rounds: number;
  durationMinutes: number;
  participantsRaw: string;
};

export function newCategoryDraft(index: number): CategoryDraft {
  return {
    key: Math.random().toString(36).slice(2, 9),
    name: index === 0 ? "Categoria única" : `Categoria ${index + 1}`,
    format: "grupos",
    teamType: "duplas",
    americanoType: "rotativo",
    setsToWin: 2,
    numGroups: 2,
    rounds: 4,
    durationMinutes: 40,
    participantsRaw: "",
  };
}

export function effectiveTeamType(draft: CategoryDraft): TeamType {
  if (draft.format === "super8") return "individual";
  if (draft.format === "americano" && draft.americanoType === "rotativo") return "individual";
  return draft.teamType;
}

export function showTeamTypeChoice(draft: CategoryDraft): boolean {
  return draft.format !== "super8" && !(draft.format === "americano" && draft.americanoType === "rotativo");
}

export function participantsLabel(draft: CategoryDraft): string {
  if (effectiveTeamType(draft) === "individual") return "Jogadores (um por linha)";
  return "Duplas (uma por linha, ex: Ana / Bia)";
}

export function participantsPlaceholder(draft: CategoryDraft): string {
  if (effectiveTeamType(draft) === "individual") return "João\nPedro\nAna\nBia\nLucas\nRafael";
  return "João / Pedro\nAna / Bia\nLucas / Rafael\nCarla / Marina";
}
