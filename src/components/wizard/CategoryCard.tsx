"use client";

import {
  CategoryDraft,
  participantsHint,
  participantsLabel,
  participantsPlaceholder,
  showTeamTypeChoice,
} from "@/lib/wizard/types";

function Choice({
  active,
  title,
  sub,
  onClick,
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <div className={`choice ${active ? "active" : ""}`} onClick={onClick}>
      <div className="choice-title">{title}</div>
      <div className="choice-sub">{sub}</div>
    </div>
  );
}

export function CategoryCard({
  draft,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  draft: CategoryDraft;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<CategoryDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="panel glass">
      <div className="actions-row" style={{ justifyContent: "space-between", marginTop: 0 }}>
        <div className="field" style={{ flex: 1, marginBottom: 0, marginRight: 12 }}>
          <label>Nome da categoria</label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={`Categoria ${index + 1}`}
          />
        </div>
        {canRemove && (
          <button
            className="btn btn-danger btn-sm"
            type="button"
            onClick={onRemove}
            style={{ marginTop: 26, flexShrink: 0 }}
          >
            Remover
          </button>
        )}
      </div>

      <div className="field">
        <label>Formato</label>
        <div className="choice-row">
          <Choice
            active={draft.format === "grupos"}
            title="Fase de grupos"
            sub="Grupos + classificação, com opção de gerar eliminatórias depois"
            onClick={() => onChange({ format: "grupos" })}
          />
          <Choice
            active={draft.format === "mata"}
            title="Eliminatórias diretas"
            sub="Mata-mata desde a primeira rodada"
            onClick={() => onChange({ format: "mata" })}
          />
          <Choice
            active={draft.format === "americano"}
            title="Americano"
            sub="Rotativo (parceiros mudam) ou duplas fixas"
            onClick={() => onChange({ format: "americano" })}
          />
          <Choice
            active={draft.format === "super8"}
            title="Super 8"
            sub="Grupos de até 8, rodízio de parceiros, final por classificação"
            onClick={() => onChange({ format: "super8" })}
          />
        </div>
      </div>

      {draft.format === "americano" && (
        <div className="field">
          <label>Tipo de americano</label>
          <div className="choice-row">
            <Choice
              active={draft.americanoType === "rotativo"}
              title="Rotativo"
              sub="Parceiros mudam a cada rodada, ranking individual"
              onClick={() => onChange({ americanoType: "rotativo" })}
            />
            <Choice
              active={draft.americanoType === "fixas"}
              title="Duplas fixas"
              sub="A dupla joga fixa contra todas as outras"
              onClick={() => onChange({ americanoType: "fixas" })}
            />
          </div>
        </div>
      )}

      {showTeamTypeChoice(draft) && (
        <div className="field">
          <label>Duplas ou individual?</label>
          <div className="choice-row">
            <Choice
              active={draft.teamType === "duplas"}
              title="Duplas"
              sub="Padel / beach tennis em dupla"
              onClick={() => onChange({ teamType: "duplas" })}
            />
            <Choice
              active={draft.teamType === "individual"}
              title="Individual"
              sub="Cada jogador é uma entrada, sorteio forma as duplas"
              onClick={() => onChange({ teamType: "individual" })}
            />
          </div>
        </div>
      )}

      <div className="field">
        <label>Como decide a partida?</label>
        <div className="choice-row">
          <Choice
            active={draft.setsToWin === 1}
            title="1 set decide"
            sub="Mais rápido — o set único define o vencedor"
            onClick={() => onChange({ setsToWin: 1 })}
          />
          <Choice
            active={draft.setsToWin === 2}
            title="Melhor de 3 sets"
            sub="Precisa vencer 2 sets para fechar a partida"
            onClick={() => onChange({ setsToWin: 2 })}
          />
        </div>
      </div>

      <div className="field">
        <label>{participantsLabel(draft)}</label>
        <textarea
          value={draft.participantsRaw}
          onChange={(e) => onChange({ participantsRaw: e.target.value })}
          placeholder={participantsPlaceholder(draft)}
        />
        <div className="hint" style={{ fontWeight: 600 }}>
          {participantsHint(draft)}
        </div>
        <div className="hint">Dá pra editar/sortear de novo depois.</div>
      </div>

      {draft.format === "grupos" && (
        <div className="field">
          <label>Número de grupos</label>
          <input
            type="number"
            min={1}
            max={16}
            value={draft.numGroups}
            onChange={(e) => onChange({ numGroups: parseInt(e.target.value) || 1 })}
          />
        </div>
      )}

      {draft.format === "americano" && draft.americanoType === "rotativo" && (
        <div className="field">
          <label>Número de rodadas</label>
          <input
            type="number"
            min={1}
            max={20}
            value={draft.rounds}
            onChange={(e) => onChange({ rounds: parseInt(e.target.value) || 1 })}
          />
        </div>
      )}

      <div className="field">
        <label>Duração média por partida (minutos)</label>
        <input
          type="number"
          min={10}
          max={180}
          value={draft.durationMinutes}
          onChange={(e) => onChange({ durationMinutes: parseInt(e.target.value) || 10 })}
        />
        <div className="hint">Usado para sortear os horários automaticamente.</div>
      </div>
    </div>
  );
}
