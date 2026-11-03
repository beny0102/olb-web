import Link from "next/link";
import { eventTitle, suspendedTitle } from "@/lib/format";
import {
  gameStatus,
  lastClosedInning,
  lastEvent,
  shortGameId,
  teamAbbr,
  topGames,
  type PortalGame,
} from "@/lib/league";
import { StatusBadge } from "./primitives";

function accentFor(entry: PortalGame): string {
  return gameStatus(entry) === "live" ? "bg-accent" : "bg-band";
}

function winnerTone(entry: PortalGame, side: "away" | "home"): string {
  const state = entry.state;
  if (!state || state.status === "scheduled") return "text-ink";
  const { away, home } = state.score;
  if (away === home) return "text-ink";
  const winner = away > home ? "away" : "home";
  return winner === side ? "text-accent font-extrabold" : "text-ink";
}

function footerLine(entry: PortalGame): string {
  const state = entry.state;
  if (!state) return "Sin estado disponible";
  if (state.status === "scheduled") return "Programado";
  if (state.status === "final") return `Final / ${lastClosedInning(entry.events) ?? state.inning}`;
  if (state.status === "suspended") return `Suspendido / ${state.inning}.ª`;
  const outs = state.outs === 1 ? "1 out" : `${state.outs} outs`;
  return `${state.inning}.ª ${state.half === "top" ? "alta" : "baja"} · ${outs}`;
}

function TeamRow({
  entry,
  side,
}: {
  entry: PortalGame;
  side: "away" | "home";
}) {
  const name = side === "away" ? entry.game.awayTeam : entry.game.homeTeam;
  const state = entry.state;
  const score =
    state && state.status !== "scheduled" ? state.score[side] : null;

  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className="flex min-w-0 items-center gap-2 font-display text-title-md uppercase text-ink"
        title={name}
      >
        <span className={`size-2 shrink-0 ${side === "home" ? "bg-accent" : "bg-ink"}`} />
        <span className="truncate">{teamAbbr(name)}</span>
      </span>
      <span className={`font-display text-tabular-stats ${winnerTone(entry, side)}`}>
        {score ?? "—"}
      </span>
    </div>
  );
}

export function PortalScoreCards({ games }: { games: readonly PortalGame[] }) {
  const cards = topGames(games);

  return (
    <section aria-label="Marcadores principales" className="border-b border-line bg-surface-low">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-3 md:px-8">
        {cards.length === 0 ? (
          <p className="py-4 text-center font-body text-body-sm text-ink-muted">
            Sin marcadores registrados.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((entry) => {
              const event = lastEvent(entry);
              return (
                <Link
                  key={entry.game.id}
                  href={`/games/${entry.game.id}`}
                  className="group relative overflow-hidden border border-line-strong bg-raised p-3 transition-colors hover:border-band"
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${accentFor(entry)}`} />
                  <div className="mb-2 mt-1 flex items-center justify-between gap-2">
                    <span className="truncate font-label-caps text-label-caps uppercase text-ink-muted">
                      Juego {shortGameId(entry.game.id)}
                    </span>
                    <StatusBadge
                      status={gameStatus(entry)}
                      suffix={
                        entry.state && entry.state.status !== "scheduled"
                          ? String(
                              entry.state.status === "final"
                                ? (lastClosedInning(entry.events) ?? entry.state.inning)
                                : entry.state.status === "suspended"
                                  ? `${entry.state.inning}.ª`
                                  : entry.state.inning,
                            )
                          : null
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <TeamRow entry={entry} side="away" />
                    <TeamRow entry={entry} side="home" />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-1.5 font-label-caps text-label-caps uppercase text-ink-muted">
                    <span>{footerLine(entry)}</span>
                    <span className="truncate text-right">
                      {gameStatus(entry) === "suspended"
                        ? (suspendedTitle(event) ?? "Suspendido")
                        : event
                          ? eventTitle(event)
                          : "Sin eventos"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
