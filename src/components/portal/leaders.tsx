import Link from "next/link";
import { formatPct } from "@/lib/format";
import { teamSlug } from "@/lib/league";
import type { LeagueSeasonStats } from "@/lib/types";
import { SectionHeader } from "./primitives";

const MOBILE_HINT =
  "mb-2 font-label-caps text-label-caps uppercase text-ink-muted md:hidden";

function EmptyLeaders({ table }: { table: "bateo" | "pitcheo" }) {
  const copy =
    table === "bateo"
      ? "Todavía no hay líderes de bateo. La tabla solo suma juegos con acta completa; los resúmenes no cuentan para estadísticas de jugadores."
      : "Todavía no hay líderes de pitcheo. La tabla solo suma juegos con acta completa; los resúmenes no cuentan para estadísticas de jugadores.";

  return (
    <p className="border border-line-strong bg-raised px-4 py-6 font-body text-body-sm text-ink-muted">
      {copy}
    </p>
  );
}

export function PortalLeaders({ stats }: { stats: LeagueSeasonStats }) {
  const { batting, pitching } = stats;

  return (
    <div className="space-y-10">
      <section id="bateo" aria-labelledby="bateo-title" className="scroll-mt-24">
        <SectionHeader
          id="bateo-title"
          kicker="Estadísticas oficiales"
          title="Líderes de bateo"
          action={
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {batting.length} {batting.length === 1 ? "bateador" : "bateadores"}
            </span>
          }
        />
        <p className="mb-3 max-w-3xl font-body text-body-sm text-ink-muted">
          PA: apariciones al plato; AB: turnos oficiales; H: hits; HR: jonrones; RBI:
          carreras impulsadas; BB: bases por bolas; SO: ponches; AVG: promedio de bateo.
        </p>

        {batting.length === 0 ? (
          <EmptyLeaders table="bateo" />
        ) : (
          <>
            <p className={MOBILE_HINT}>Desliza para ver la tabla completa →</p>
            <div className="overflow-x-auto border border-line-strong bg-raised">
              <table className="w-full min-w-[58rem] border-collapse text-left">
                <caption className="sr-only">Líderes de bateo de la temporada</caption>
                <thead>
                  <tr className="border-b-2 border-band bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
                    <th scope="col" className="px-3 py-2">
                      Jugador
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Equipo
                    </th>
                    {["PA", "AB", "H", "HR", "RBI", "BB", "SO", "AVG"].map((label) => (
                      <th key={label} scope="col" className="px-3 py-2 text-right">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batting.map((player) => (
                    <tr
                      key={player.playerId}
                      className="border-b border-line bg-raised transition-colors even:bg-table-alt hover:bg-surface-low"
                    >
                      <th
                        scope="row"
                        className="px-3 py-3 font-display text-title-lg uppercase text-ink"
                      >
                        {player.player}
                        {player.jersey || player.position ? (
                          <span className="mt-0.5 block font-body text-[11px] font-normal normal-case tracking-normal text-ink-muted">
                            {[player.jersey ? `#${player.jersey}` : null, player.position]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </th>
                      <td className="px-3 py-3 font-body text-body-sm text-ink-muted">
                        <Link
                          href={`/teams/${teamSlug(player.team)}`}
                          className="transition-colors hover:text-accent hover:underline"
                        >
                          {player.team}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.pa}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.ab}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.h}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.hr}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.rbi}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.bb}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.so}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.avg === null ? "—" : formatPct(player.avg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section id="pitcheo" aria-labelledby="pitcheo-title" className="scroll-mt-24">
        <SectionHeader
          id="pitcheo-title"
          kicker="Estadísticas oficiales"
          title="Líderes de pitcheo"
          action={
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {pitching.length} {pitching.length === 1 ? "lanzador" : "lanzadores"}
            </span>
          }
        />
        <p className="mb-3 max-w-3xl font-body text-body-sm text-ink-muted">
          Lanz.: lanzamientos registrados; SO: ponches; BB: bases por bolas; Apariciones:
          juegos en los que lanzó.
        </p>

        {pitching.length === 0 ? (
          <EmptyLeaders table="pitcheo" />
        ) : (
          <>
            <p className={MOBILE_HINT}>Desliza para ver la tabla completa →</p>
            <div className="overflow-x-auto border border-line-strong bg-raised">
              <table className="w-full min-w-[42rem] border-collapse text-left">
                <caption className="sr-only">Líderes de pitcheo de la temporada</caption>
                <thead>
                  <tr className="border-b-2 border-band bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
                    <th scope="col" className="px-3 py-2">
                      Jugador
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Equipo
                    </th>
                    {["Lanz.", "SO", "BB", "Apariciones"].map((label) => (
                      <th key={label} scope="col" className="px-3 py-2 text-right">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pitching.map((player) => (
                    <tr
                      key={player.playerId}
                      className="border-b border-line bg-raised transition-colors even:bg-table-alt hover:bg-surface-low"
                    >
                      <th
                        scope="row"
                        className="px-3 py-3 font-display text-title-lg uppercase text-ink"
                      >
                        {player.player}
                        {player.jersey || player.position ? (
                          <span className="mt-0.5 block font-body text-[11px] font-normal normal-case tracking-normal text-ink-muted">
                            {[player.jersey ? `#${player.jersey}` : null, player.position]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </th>
                      <td className="px-3 py-3 font-body text-body-sm text-ink-muted">
                        <Link
                          href={`/teams/${teamSlug(player.team)}`}
                          className="transition-colors hover:text-accent hover:underline"
                        >
                          {player.team}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.pitches}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.so}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.bb}
                      </td>
                      <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                        {player.appearances}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
