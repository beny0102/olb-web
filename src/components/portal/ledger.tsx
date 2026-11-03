import Link from "next/link";
import { eventDetail, eventTitle } from "@/lib/format";
import {
  gameStatus,
  lastClosedInning,
  lastEvent,
  ledgerGames,
  scoreLabel,
  shortGameId,
  teamAbbr,
  type PortalGame,
} from "@/lib/league";
import { Arrow, InningMark, SectionHeader, StatusBadge } from "./primitives";

function LedgerRow({ entry }: { entry: PortalGame }) {
  const event = lastEvent(entry);
  const state = entry.state;
  const suspended = gameStatus(entry) === "suspended";

  return (
    <tr className="border-b border-line bg-raised transition-colors even:bg-table-alt hover:bg-surface-low">
      <td className="px-3 py-3">
        <div className="font-display text-title-lg uppercase text-ink">
          {teamAbbr(entry.game.awayTeam)} @ {teamAbbr(entry.game.homeTeam)}
        </div>
        <div className="mt-0.5 font-body text-body-sm uppercase text-ink-muted">
          {entry.game.awayTeam} vs {entry.game.homeTeam} · {shortGameId(entry.game.id)}
        </div>
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={gameStatus(entry)} />
      </td>
      <td className="px-3 py-3 font-display text-tabular-stats text-ink">
        {scoreLabel(entry)}
      </td>
      <td className="px-3 py-3 font-body text-body-sm text-ink-muted">
        <InningMark state={state} closedInning={lastClosedInning(entry.events)} />
        {state && state.status !== "scheduled" && state.status !== "final" && state.status !== "suspended"
          ? ` · ${state.count.balls}-${state.count.strikes}`
          : ""}
      </td>
      <td className="max-w-[22rem] px-3 py-3">
        <div className="font-body text-body-sm font-semibold text-ink">
          {suspended ? "Suspendido" : event ? eventTitle(event) : "Sin eventos"}
        </div>
        <div className="mt-0.5 font-body text-body-sm text-ink-muted">
          {event ? eventDetail(event) ?? `Secuencia ${event.seq}` : "—"}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <Link
          href={`/games/${entry.game.id}`}
          className="inline-flex items-center gap-1 font-label-caps text-label-caps uppercase text-accent hover:text-band"
        >
          Abrir <Arrow />
        </Link>
      </td>
    </tr>
  );
}

export function PortalLedger({ games }: { games: readonly PortalGame[] }) {
  const rows = ledgerGames(games);

  return (
    <section id="registro" aria-labelledby="registro-title" className="scroll-mt-24 py-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <SectionHeader
          id="registro-title"
          kicker="Tabla oficial de la jornada"
          title="Registro de la jornada"
          action={
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {rows.length} {rows.length === 1 ? "juego" : "juegos"} en el acta
            </span>
          }
        />
        <p className="mb-3 max-w-3xl font-body text-body-sm text-ink-muted">
          Cada fila es un juego del registro append-only. No hay tabla de posiciones: la API
          todavía no expone el dominio de clasificación.
        </p>

        {rows.length === 0 ? (
          <p className="font-body text-body-sm text-ink-muted">Sin juegos registrados.</p>
        ) : (
          <div className="overflow-x-auto border border-line-strong bg-raised">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">Registro de la jornada</caption>
              <thead>
                <tr className="border-b-2 border-band bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
                  <th scope="col" className="px-3 py-2">
                    Juego
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Marcador
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Entrada
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Último evento
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Acta
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <LedgerRow key={entry.game.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
