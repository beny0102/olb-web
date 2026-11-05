import Link from "next/link";
import { shortGameId, SUMMARY_NOTE, teamAbbr, teamSlug } from "@/lib/league";
import type { GameDataSource, LeagueGameDetail } from "@/lib/types";
import { Arrow, StatusBadge } from "./primitives";

const SOURCE_LABEL: Record<GameDataSource, string> = {
  official: "Oficial",
  team_report: "Reporte de club",
  import: "Importado",
  external: "Fuente externa",
};

function coverageLabel(detail: LeagueGameDetail): string {
  return detail.game.coverage === "summary" ? "Resumen" : "Fuente externa";
}

interface BoxLine {
  runs: number | null;
  hits: number | null;
  errors: number | null;
  innings: (number | null)[];
}

function readBoxSide(value: unknown): BoxLine | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const number = (key: string): number | null =>
    typeof row[key] === "number" ? (row[key] as number) : null;
  const innings = Array.isArray(row.linescore)
    ? row.linescore.map((entry) => (typeof entry === "number" ? entry : null))
    : [];
  const line: BoxLine = {
    runs: number("runs"),
    hits: number("hits"),
    errors: number("errors"),
    innings,
  };
  if (
    line.runs === null &&
    line.hits === null &&
    line.errors === null &&
    line.innings.length === 0
  ) {
    return null;
  }
  return line;
}

function readTeamBox(value: unknown): { away: BoxLine | null; home: BoxLine | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const box = value as Record<string, unknown>;
  const away = readBoxSide(box.away);
  const home = readBoxSide(box.home);
  return away || home ? { away, home } : null;
}

function readLinescore(value: unknown): { away: (number | null)[]; home: (number | null)[] } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const line = value as Record<string, unknown>;
  const read = (side: unknown): (number | null)[] | null =>
    Array.isArray(side)
      ? side.map((entry) => (typeof entry === "number" ? entry : null))
      : null;
  const away = read(line.away);
  const home = read(line.home);
  return away || home ? { away: away ?? [], home: home ?? [] } : null;
}

function SummaryBox({ detail }: { detail: LeagueGameDetail }) {
  const box = readTeamBox(detail.summary?.teamBox);
  const linescore = readLinescore(detail.summary?.linescore);

  if (!box && !linescore) {
    return (
      <div className="border-l-4 border-band bg-surface-low p-4">
        <span className="block font-label-caps text-label-caps uppercase text-accent">
          Solo resultado
        </span>
        <p className="mt-1 font-body text-body-md text-ink">
          El resumen no incluye caja de equipos ni anotación por entrada.
        </p>
        <p className="mt-1 font-body text-body-sm text-ink-muted">{SUMMARY_NOTE}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {box ? (
        <div>
          <p className="mb-2 font-label-caps text-label-caps uppercase text-ink-muted">
            Caja del resumen
          </p>
          <div className="overflow-x-auto border border-line-strong bg-raised">
            <table className="w-full min-w-[24rem] border-collapse text-left">
              <caption className="sr-only">Caja de equipos registrada en el resumen</caption>
              <thead>
                <tr className="border-b-2 border-band bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
                  <th scope="col" className="px-3 py-2">
                    Club
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    C
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    H
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    E
                  </th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Visitante", detail.game.awayTeam, box.away],
                    ["Local", detail.game.homeTeam, box.home],
                  ] as const
                ).map(([label, name, line]) => (
                  <tr key={label} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-3 py-2 font-display text-title-md uppercase text-ink">
                      {name}
                    </th>
                    <td className="px-3 py-2 text-right font-display text-tabular-stats text-ink">
                      {line?.runs ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right font-display text-tabular-stats text-ink">
                      {line?.hits ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right font-display text-tabular-stats text-ink">
                      {line?.errors ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {linescore ? (
        <div>
          <p className="mb-2 font-label-caps text-label-caps uppercase text-ink-muted">
            Anotación por entrada
          </p>
          <div className="overflow-x-auto border-l-2 border-band bg-surface-low p-2">
            <table className="w-full min-w-[24rem] border-collapse text-center font-display text-tabular-stats">
              <caption className="sr-only">Línea por entrada registrada en el resumen</caption>
              <thead>
                <tr className="border-b border-line-strong font-label-caps text-label-caps uppercase text-ink-muted">
                  <th scope="col" className="px-2 py-1 text-left">
                    Club
                  </th>
                  {Array.from(
                    { length: Math.max(linescore.away.length, linescore.home.length) },
                    (_, index) => (
                      <th key={index} scope="col" className="min-w-6 px-1 py-1">
                        {index + 1}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(
                  [
                    [detail.game.awayTeam, linescore.away],
                    [detail.game.homeTeam, linescore.home],
                  ] as const
                ).map(([name, line]) => (
                  <tr key={name}>
                    <th scope="row" className="px-2 py-1 text-left font-display text-title-md uppercase text-ink">
                      {teamAbbr(name)}
                    </th>
                    {Array.from(
                      { length: Math.max(linescore.away.length, linescore.home.length) },
                      (_, index) => (
                        <td key={index} className="px-1 py-1 text-ink">
                          {line[index] ?? "–"}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SummaryGame({
  detail,
  seasonName,
  competitionName,
}: {
  detail: LeagueGameDetail;
  seasonName: string | null;
  competitionName: string | null;
}) {
  const { game, summary } = detail;
  const score =
    game.score ??
    (summary && summary.homeScore !== null && summary.awayScore !== null
      ? { home: summary.homeScore, away: summary.awayScore }
      : null);
  const away = teamAbbr(game.awayTeam);
  const home = teamAbbr(game.homeTeam);

  return (
    <article className="overflow-hidden border border-line-strong bg-raised">
      <h1 className="sr-only">
        Resumen: {game.awayTeam} {score ? `${score.away}–${score.home}` : "sin marcador"}{" "}
        {game.homeTeam}
      </h1>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-accent bg-band px-4 py-2 text-band-ink">
        <div className="flex flex-wrap items-center gap-3">
          <span className="bg-accent px-2 py-1 font-label-caps text-label-caps uppercase">
            {coverageLabel(detail)}
          </span>
          <span className="font-label-caps text-label-caps uppercase text-band-muted">
            Juego {shortGameId(game.id)}
          </span>
        </div>
        <span className="font-label-caps text-label-caps uppercase text-gold">
          {SOURCE_LABEL[game.dataSource]}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={game.status} />
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {coverageLabel(detail)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0">
              <p className="truncate font-display text-headline-md uppercase text-ink">
                {game.awayTeam}
              </p>
              <p className="font-label-caps text-label-caps uppercase text-ink-muted">Visitante</p>
            </div>
            <span className="font-display text-tabular-stats text-accent">
              {score ? `${score.away}–${score.home}` : "—"}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-headline-md uppercase text-accent">
                {game.homeTeam}
              </p>
              <p className="font-label-caps text-label-caps uppercase text-ink-muted">Local</p>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Temporada</dt>
            <dd className="font-body text-body-sm font-semibold text-ink">
              {seasonName ?? "Sin temporada"}
            </dd>
          </div>
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Competencia</dt>
            <dd className="font-body text-body-sm font-semibold text-ink">
              {competitionName ?? "Sin competencia"}
            </dd>
          </div>
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Cobertura</dt>
            <dd className="font-body text-body-sm font-semibold text-ink">
              {coverageLabel(detail)}
            </dd>
          </div>
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Fuente</dt>
            <dd className="font-body text-body-sm font-semibold text-ink">
              {SOURCE_LABEL[game.dataSource]}
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-line p-5 md:p-6">
        <SummaryBox detail={detail} />
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-surface-low px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="font-body text-body-sm text-ink-muted">
          Este juego no tiene registro de jugadas en el sistema.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {game.seasonId ? (
            <Link
              href={`/?season=${encodeURIComponent(game.seasonId)}`}
              className="inline-flex items-center gap-1 border border-line-strong px-3 py-2 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-band"
            >
              {seasonName ? `Temporada ${seasonName}` : "Temporada"} <Arrow />
            </Link>
          ) : null}
          <Link
            href={`/teams/${teamSlug(game.awayTeam)}`}
            className="inline-flex items-center gap-1 border border-line-strong px-3 py-2 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-band"
          >
            {away} <Arrow />
          </Link>
          <Link
            href={`/teams/${teamSlug(game.homeTeam)}`}
            className="inline-flex items-center gap-1 border border-line-strong px-3 py-2 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-band"
          >
            {home} <Arrow />
          </Link>
        </div>
      </div>
    </article>
  );
}
