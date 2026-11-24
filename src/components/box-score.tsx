import { formatLinescore } from "@/lib/format";
import type {
  BoxScore,
  GameRecord,
  PlayerBattingLine,
  PlayerPitchingLine,
  TeamBoxScore,
} from "@/lib/types";

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

function inningsPitched(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function battingAverage(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(3).replace(/^0\./, ".");
}

function PlayerName({ line }: { line: PlayerBattingLine | PlayerPitchingLine }) {
  const showJersey = line.jersey !== null && !line.name.startsWith("#");
  return (
    <th scope="row" className="px-3 py-2 text-left font-body text-body-sm text-ink">
      {showJersey ? (
        <span className="mr-1 font-display text-ink-muted">#{line.jersey}</span>
      ) : null}
      {line.name}
    </th>
  );
}

function StatCell({ value }: { value: number | string }) {
  return <td className="px-2 py-2 text-right font-display text-tabular-stats text-ink">{value}</td>;
}

function BattingTable({ lines, team }: { lines: PlayerBattingLine[]; team: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <caption className="sr-only">Bateo por jugador de {team}</caption>
        <thead>
          <tr className="border-b border-line bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
            <th scope="col" className="px-3 py-2 text-left">
              Jugador
            </th>
            {["AB", "R", "H", "HR", "RBI", "BB", "SO", "AVG"].map((label) => (
              <th key={label} scope="col" className="px-2 py-2 text-right">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.playerId} className="border-b border-line last:border-b-0">
              <PlayerName line={line} />
              <StatCell value={line.ab} />
              <StatCell value={line.r} />
              <StatCell value={line.h} />
              <StatCell value={line.hr} />
              <StatCell value={line.rbi} />
              <StatCell value={line.bb} />
              <StatCell value={line.so} />
              <StatCell value={battingAverage(line.avg)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PitchingTable({ lines, team }: { lines: PlayerPitchingLine[]; team: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">Pitcheo por jugador de {team}</caption>
        <thead>
          <tr className="border-b border-line bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
            <th scope="col" className="px-3 py-2 text-left">
              Jugador
            </th>
            {["IP", "BF", "H", "R", "BB", "SO", "PIT"].map((label) => (
              <th key={label} scope="col" className="px-2 py-2 text-right">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.playerId} className="border-b border-line last:border-b-0">
              <PlayerName line={line} />
              <StatCell value={inningsPitched(line.outs)} />
              <StatCell value={line.battersFaced} />
              <StatCell value={line.h} />
              <StatCell value={line.r} />
              <StatCell value={line.bb} />
              <StatCell value={line.so} />
              <StatCell value={line.pitches} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamPlayers({
  name,
  side,
  line,
}: {
  name: string;
  side: "Visitante" | "Local";
  line: TeamBoxScore;
}) {
  if (line.batting.length === 0 && line.pitching.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b border-line bg-surface-low px-5 py-3">
        <h3 className="font-display text-title-md uppercase text-ink">{name}</h3>
        <span className="font-label-caps text-label-caps uppercase text-ink-muted">{side}</span>
      </div>
      {line.batting.length > 0 ? (
        <div>
          <p className="px-5 pb-1 pt-3 font-label-caps text-label-caps uppercase text-ink-muted">
            Bateo
          </p>
          <BattingTable lines={line.batting} team={name} />
        </div>
      ) : null}
      {line.pitching.length > 0 ? (
        <div>
          <p className="px-5 pb-1 pt-3 font-label-caps text-label-caps uppercase text-ink-muted">
            Pitcheo
          </p>
          <PitchingTable lines={line.pitching} team={name} />
        </div>
      ) : null}
    </div>
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

      {[boxScore.away, boxScore.home].some(
        (line) => line.batting.length > 0 || line.pitching.length > 0,
      ) ? (
        <div className="divide-y divide-line border-t border-line-strong">
          <p className="px-5 py-2 font-label-caps text-label-caps uppercase text-ink-muted md:hidden">
            Desliza las tablas de jugadores →
          </p>
          <TeamPlayers name={game.awayTeam} side="Visitante" line={boxScore.away} />
          <TeamPlayers name={game.homeTeam} side="Local" line={boxScore.home} />
        </div>
      ) : null}
    </section>
  );
}
