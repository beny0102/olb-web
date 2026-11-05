import Link from "next/link";
import { eventDetail, eventTitle, formatScheduledStart, suspendedTitle } from "@/lib/format";
import {
  coverageLabel,
  gameStatus,
  isSummaryGame,
  lastClosedInning,
  lastEvent,
  orderSlate,
  scoreLabel,
  scoreOf,
  shortGameId,
  SUMMARY_NOTE,
  teamAbbr,
  type PortalGame,
} from "@/lib/league";
import { Arrow, InningMark, SectionHeader, StatusBadge } from "./primitives";

const SLATE_LIMIT = 4;

function accentFor(entry: PortalGame): string {
  return gameStatus(entry) === "live" ? "border-t-accent" : "border-t-band";
}

function SlateCard({ entry }: { entry: PortalGame }) {
  const state = entry.state;
  const event = lastEvent(entry);
  const scheduled = gameStatus(entry) === "scheduled";
  const summary = isSummaryGame(entry);
  const score = scoreOf(entry);
  const start = formatScheduledStart(entry.game.scheduledStart);
  const venue = entry.game.venue?.trim() || null;
  const suspended = state?.status === "suspended" ? (suspendedTitle(event) ?? "Suspendido") : null;

  return (
    <Link
      href={`/games/${entry.game.id}`}
      className={`group flex flex-col border border-line-strong border-t-4 bg-raised p-4 transition-colors hover:border-band ${accentFor(entry)}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="font-label-caps text-label-caps uppercase text-accent">
          Juego {shortGameId(entry.game.id)}
        </span>
        <StatusBadge status={gameStatus(entry)} />
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="block font-display text-headline-sm uppercase text-ink">
            {teamAbbr(entry.game.awayTeam)} @ {teamAbbr(entry.game.homeTeam)}
          </span>
          <span className="mt-1 block truncate font-body text-body-sm uppercase text-ink-muted">
            {entry.game.awayTeam} vs {entry.game.homeTeam} · {shortGameId(entry.game.id)}
          </span>
        </div>
        {scheduled ? (
          <span className="shrink-0 text-right font-display text-title-md uppercase text-ink">
            {start ?? "Por confirmar"}
          </span>
        ) : (
          <span className="shrink-0 font-display text-tabular-stats text-ink-muted">
            {score ? `${score.away}–${score.home}` : "—"}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2 border-t border-line pt-2">
        <div className="flex items-center justify-between gap-2 font-label-caps text-label-caps uppercase">
          <span className="text-ink-muted">Estado</span>
          <span className="text-ink">
            {summary ? (
              <span>
                Final · {coverageLabel(entry)}
              </span>
            ) : (
              <>
                <InningMark state={state} closedInning={lastClosedInning(entry.events)} />
                {state && state.status !== "scheduled" && state.status !== "final"
                  ? ` · ${state.outs === 1 ? "1 out" : `${state.outs} outs`}`
                  : ""}
              </>
            )}
          </span>
        </div>
        {scheduled ? (
          <div className="flex items-start justify-between gap-2 font-label-caps text-label-caps uppercase">
            <span className="shrink-0 text-ink-muted">Sede</span>
            <span className="text-right text-ink">{venue ?? "Por confirmar"}</span>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2 font-label-caps text-label-caps uppercase">
          <span className="shrink-0 text-ink-muted">Último evento</span>
          <span className="text-right text-ink">
            {summary
              ? SUMMARY_NOTE
              : suspended ?? (event ? eventTitle(event) : "Sin eventos")}
            {summary || suspended ? "" : event ? ` · ${eventDetail(event) ?? `seq ${event.seq}`}` : ""}
          </span>
        </div>
      </div>

      <span className="mt-4 flex items-center justify-between border-t border-line pt-2 font-label-caps text-label-caps uppercase text-ink group-hover:text-accent">
        <span>{scoreLabel(entry)}</span>
        <span className="inline-flex items-center gap-1">
          Acta <Arrow />
        </span>
      </span>
    </Link>
  );
}

export function PortalSlate({ games }: { games: readonly PortalGame[] }) {
  const slate = orderSlate(games).slice(0, SLATE_LIMIT);
  const hasScheduled = games.some((entry) => gameStatus(entry) === "scheduled");

  if (!hasScheduled && games.length <= SLATE_LIMIT) return null;

  return (
    <section
      id="jornada"
      aria-labelledby="jornada-title"
      className="scroll-mt-24 border-y border-line bg-surface-low py-8"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <SectionHeader
          id="jornada-title"
          kicker="Jornada oficial y registro diario"
          title="Competencia oficial"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-band px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink">
                {hasScheduled ? "Programados" : "Últimos registros"}
              </span>
              <Link
                href="#registro"
                className="border border-line-strong px-2 py-1 font-label-caps text-label-caps uppercase text-ink-muted transition-colors hover:border-band hover:text-ink"
              >
                Registro completo <Arrow />
              </Link>
            </div>
          }
        />

        {slate.length === 0 ? (
          <p className="font-body text-body-sm text-ink-muted">
            Sin juegos programados ni registrados.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {slate.map((entry) => (
              <SlateCard key={entry.game.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
