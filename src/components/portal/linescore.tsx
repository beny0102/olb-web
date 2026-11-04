import { deriveLinescore, teamAbbr, type PortalGame } from "@/lib/league";

function runs(value: number | null): string {
  return value === null ? "–" : String(value);
}

export function PortalLinescore({ entry }: { entry: PortalGame }) {
  const line = deriveLinescore(entry.events);
  const state = entry.state;
  const away = teamAbbr(entry.game.awayTeam);
  const home = teamAbbr(entry.game.homeTeam);
  const total = (side: "away" | "home"): string => {
    if (!state || state.status === "scheduled") return "–";
    return String(state.score[side]);
  };

  if (!line.hasData) {
    return (
      <div className="border-l-2 border-band bg-surface-low p-3">
        <p className="font-label-caps text-label-caps uppercase text-ink-muted">
          Línea de entradas
        </p>
        <p className="mt-1 font-body text-body-sm text-ink-muted">
          Sin entradas cerradas registradas en el acta.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-2 font-label-caps text-label-caps uppercase text-ink-muted md:hidden">
        Desliza para ver la tabla completa →
      </p>
      <div className="overflow-x-auto border-l-2 border-band bg-surface-low p-2">
        <table className="w-full min-w-[34rem] border-collapse text-center font-display text-tabular-stats">
          <caption className="sr-only">
            Línea de anotación por entrada de {entry.game.awayTeam} y {entry.game.homeTeam}
          </caption>
          <thead>
            <tr className="border-b border-line-strong font-label-caps text-label-caps uppercase text-ink-muted">
              <th scope="col" className="px-2 py-1 text-left">
                Club
              </th>
              {line.innings.map((inning) => (
                <th key={inning.inning} scope="col" className="min-w-6 px-1 py-1">
                  {inning.inning}
                </th>
              ))}
              <th scope="col" className="bg-raised px-2 py-1 text-ink">
                R
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <th scope="row" className="px-2 py-1 text-left font-display text-title-md uppercase text-ink">
                {away}
              </th>
              {line.innings.map((inning) => (
                <td key={inning.inning} className="px-1 py-1 text-ink">
                  {runs(inning.away)}
                </td>
              ))}
              <td className="bg-raised px-2 py-1 font-extrabold text-ink">{total("away")}</td>
            </tr>
            <tr>
              <th scope="row" className="px-2 py-1 text-left font-display text-title-md uppercase text-accent">
                {home}
              </th>
              {line.innings.map((inning) => (
                <td key={inning.inning} className="px-1 py-1 text-ink">
                  {runs(inning.home)}
                </td>
              ))}
              <td className="bg-raised px-2 py-1 font-extrabold text-accent">{total("home")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
