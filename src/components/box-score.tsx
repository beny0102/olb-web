import { formatLinescore } from "@/lib/format";
import type { BoxScore, GameRecord } from "@/lib/types";

function TeamRow({
  name,
  side,
  line,
  alt,
}: {
  name: string;
  side: "Visitante" | "Local";
  line: BoxScore["away"];
  alt: boolean;
}) {
  const cells = formatLinescore(line.linescore);

  return (
    <tr className={`border-b border-line last:border-b-0 ${alt ? "bg-table-alt" : "bg-raised"}`}>
      <th scope="row" className="px-3 py-2 text-left">
        <span className="block font-display text-title-md uppercase text-ink">{name}</span>
        <span className="font-label-caps text-label-caps uppercase text-ink-muted">{side}</span>
      </th>
      {cells.map((value, index) => (
        <td key={index} className="px-2 py-2 font-display text-tabular-stats text-ink">
          {value}
        </td>
      ))}
      <td className="border-l border-line px-2 py-2 font-display text-tabular-stats text-ink">
        {line.runs}
      </td>
      <td className="px-2 py-2 font-display text-tabular-stats text-ink">{line.hits}</td>
      <td className="px-2 py-2 font-display text-tabular-stats text-ink">{line.errors}</td>
    </tr>
  );
}

export function BoxScorePanel({
  game,
  boxScore,
}: {
  game: GameRecord;
  boxScore: BoxScore;
}) {
  const innings = formatLinescore(boxScore.home.linescore);

  return (
    <section className="border border-line-strong bg-raised" aria-label="Línea de anotación">
      <header className="flex items-center justify-between border-b-2 border-band bg-table-head px-5 py-3">
        <h2 className="font-display text-title-md uppercase text-ink">Línea de anotación</h2>
        <span className="font-label-caps text-label-caps uppercase text-ink-muted">R · H · E</span>
      </header>

      <p className="mb-2 px-5 font-label-caps text-label-caps uppercase text-ink-muted md:hidden">
        Desliza para ver la tabla completa →
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-center">
          <caption className="sr-only">
            Anotación por entrada de {game.awayTeam} y {game.homeTeam}, con carreras, hits y
            errores
          </caption>
          <thead>
            <tr className="border-b border-line bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
              <th scope="col" className="px-3 py-2 text-left">
                Equipo
              </th>
              {innings.map((_, index) => (
                <th key={index} scope="col" className="min-w-6 px-1 py-2">
                  {index + 1}
                </th>
              ))}
              <th scope="col" className="border-l border-line px-2 py-2 text-ink">
                R
              </th>
              <th scope="col" className="px-2 py-2 text-ink">
                H
              </th>
              <th scope="col" className="px-2 py-2 text-ink">
                E
              </th>
            </tr>
          </thead>
          <tbody>
            <TeamRow name={game.awayTeam} side="Visitante" line={boxScore.away} alt={false} />
            <TeamRow name={game.homeTeam} side="Local" line={boxScore.home} alt />
          </tbody>
        </table>
      </div>
    </section>
  );
}
