import { formatLinescore } from "@/lib/format";
import type { BoxScore, GameRecord } from "@/lib/types";

function TeamRow({
  name,
  side,
  line,
}: {
  name: string;
  side: "Visitante" | "Local";
  line: BoxScore["away"];
}) {
  const cells = formatLinescore(line.linescore);

  return (
    <tr className="border-b border-nightline last:border-b-0">
      <th scope="row" className="px-3 py-2 text-left">
        <span className="block text-sm font-medium text-chalk">{name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{side}</span>
      </th>
      {cells.map((value, index) => (
        <td key={index} className="px-2 py-2 font-mono text-sm tabular-nums text-chalk">
          {value}
        </td>
      ))}
      <td className="border-l border-nightline px-2 py-2 font-mono text-sm font-semibold tabular-nums text-chalk">
        {line.runs}
      </td>
      <td className="px-2 py-2 font-mono text-sm tabular-nums text-chalk">{line.hits}</td>
      <td className="px-2 py-2 font-mono text-sm tabular-nums text-chalk">{line.errors}</td>
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
    <section className="panel" aria-label="Línea de anotación">
      <header className="flex items-center justify-between border-b border-nightline px-5 py-3">
        <h2 className="text-sm font-semibold">Línea de anotación</h2>
        <span className="font-mono text-[11px] text-muted">R · H · E</span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-center">
          <caption className="sr-only">
            Anotación por entrada de {game.awayTeam} y {game.homeTeam}, con carreras, hits y
            errores
          </caption>
          <thead>
            <tr className="border-b border-nightline font-mono text-[10px] uppercase tracking-wider text-muted">
              <th scope="col" className="px-3 py-2 text-left">
                Equipo
              </th>
              {innings.map((_, index) => (
                <th key={index} scope="col" className="min-w-6 px-1 py-2">
                  {index + 1}
                </th>
              ))}
              <th scope="col" className="border-l border-nightline px-2 py-2 text-chalk">
                R
              </th>
              <th scope="col" className="px-2 py-2 text-chalk">
                H
              </th>
              <th scope="col" className="px-2 py-2 text-chalk">
                E
              </th>
            </tr>
          </thead>
          <tbody>
            <TeamRow name={game.awayTeam} side="Visitante" line={boxScore.away} />
            <TeamRow name={game.homeTeam} side="Local" line={boxScore.home} />
          </tbody>
        </table>
      </div>
    </section>
  );
}
