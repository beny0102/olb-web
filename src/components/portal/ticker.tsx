import Link from "next/link";
import { eventDetail, eventTitle, suspendedTitle } from "@/lib/format";
import type { PortalGame } from "@/lib/league";
import {
  gameStatus,
  isSummaryGame,
  lastClosedInning,
  lastEvent,
  orderGames,
  scoreLabel,
  SUMMARY_NOTE,
} from "@/lib/league";
import { StatusBadge } from "./primitives";

function detail(entry: PortalGame): string {
  const event = lastEvent(entry);
  if (!event) return isSummaryGame(entry) ? SUMMARY_NOTE : "Sin eventos registrados";
  if (gameStatus(entry) === "suspended") return suspendedTitle(event) ?? "Suspendido";
  const extra = eventDetail(event);
  return extra ? `${eventTitle(event)} · ${extra}` : eventTitle(event);
}

export function PortalTicker({ games }: { games: readonly PortalGame[] }) {
  const ordered = orderGames(games);

  return (
    <section aria-label="Boletín de juegos" className="border-b border-line bg-surface-low">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 overflow-x-auto px-4 py-2 md:px-8">
        <span className="flex shrink-0 items-center gap-1.5 font-label-caps text-label-caps uppercase text-accent">
          <span className="size-1.5 bg-accent" />
          Boletín oficial
        </span>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line-strong" />

        {games.length === 0 ? (
          <span className="shrink-0 font-body text-body-sm text-ink-muted">
            Sin juegos en el registro.
          </span>
        ) : (
          ordered.map((entry) => (
            <Link
              key={entry.game.id}
              href={`/games/${entry.game.id}`}
              className="group flex shrink-0 items-center gap-2 border-r border-line pr-4 last:border-r-0 last:pr-0"
            >
              <StatusBadge
                status={gameStatus(entry)}
                suffix={
                  entry.state?.status === "final"
                    ? String(lastClosedInning(entry.events) ?? entry.state.inning)
                    : entry.state?.status === "live"
                      ? `${entry.state.inning}.ª ${entry.state.half === "top" ? "alta" : "baja"}`
                      : null
                }
              />
              <span className="font-display text-tabular-stats uppercase text-ink group-hover:text-accent">
                {scoreLabel(entry)}
              </span>
              <span className="max-w-[20rem] truncate font-body text-body-sm text-ink-muted">
                {detail(entry)}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
