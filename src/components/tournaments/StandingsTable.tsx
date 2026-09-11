import type { StandingRow } from "@/lib/tournament-logic/standings";

/** Tabela de classificação de um grupo. As `highlight` primeiras linhas (classificados) ganham destaque. */
export function StandingsTable({ rows, highlight = 0 }: { rows: StandingRow[]; highlight?: number }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Dupla</th>
            <th className="num" title="Jogos">J</th>
            <th className="num" title="Vitórias">V</th>
            <th className="num" title="Saldo de sets">SS</th>
            <th className="num" title="Saldo de games">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.entryId} className={i < highlight ? "top" : undefined}>
              <td>{i + 1}</td>
              <td>{r.name}</td>
              <td className="num">{r.played}</td>
              <td className="num">{r.wins}</td>
              <td className="num">{signed(r.setsWon - r.setsLost)}</td>
              <td className="num">{signed(r.gamesWon - r.gamesLost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
