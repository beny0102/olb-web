import Link from "next/link";
import { formatPct } from "@/lib/format";
import { teamSlug, visibleStandings } from "@/lib/league";
import type { Standings } from "@/lib/types";
import { SectionHeader } from "./primitives";

export function PortalStandings({ standings }: { standings: Standings | null }) {
  const rows = visibleStandings(standings);

  // A one-club table cannot rank anybody; the band is omitted entirely.
  if (rows.length === 0 || !standings) return null;

  return (
    <section id="posiciones" aria-labelledby="posiciones-title" className="scroll-mt-24 pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <SectionHeader
          id="posiciones-title"
          kicker="Clasificación oficial"
          title="Tabla de posiciones"
          action={
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {standings.games} {standings.games === 1 ? "juego finalizado" : "juegos finalizados"}
            </span>
          }
        />
        <p className="mb-3 max-w-3xl font-body text-body-sm text-ink-muted">
          Solo cuentan los juegos con resultado final en el acta. G y P son juegos ganados y
          perdidos; CF y CC, carreras anotadas y recibidas.
        </p>

        <p className="mb-2 font-label-caps text-label-caps uppercase text-ink-muted md:hidden">
          Desliza para ver la tabla completa →
        </p>
        <div className="overflow-x-auto border border-line-strong bg-raised">
          <table className="w-full min-w-[38rem] border-collapse text-left">
            <caption className="sr-only">Tabla de posiciones de la liga</caption>
            <thead>
              <tr className="border-b-2 border-band bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
                <th scope="col" className="px-3 py-2">
                  Equipo
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  G
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  P
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  CF
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  CC
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Pct
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.team}
                  className="border-b border-line bg-raised transition-colors even:bg-table-alt hover:bg-surface-low"
                >
                  <th
                    scope="row"
                    className="px-3 py-3 font-display text-title-lg uppercase text-ink"
                  >
                    <Link
                      href={`/equipos/${teamSlug(row.team)}`}
                      className="transition-colors hover:text-accent hover:underline"
                    >
                      {row.team}
                    </Link>
                  </th>
                  <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                    {row.w}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                    {row.l}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                    {row.runsFor}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                    {row.runsAgainst}
                  </td>
                  <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                    {formatPct(row.pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
