import Link from "next/link";
import { callLabel, eventDetail, eventTitle } from "@/lib/format";
import {
  coverageLabel,
  gameHeadline,
  gameStatus,
  isSummaryGame,
  lastBallInPlay,
  lastClosedInning,
  lastEvent,
  lastPitch,
  scoreOf,
  shortGameId,
  SUMMARY_NOTE,
  teamAbbr,
  type PortalGame,
} from "@/lib/league";
import { PortalGameRail } from "./game-rail";
import { PortalLinescore } from "./linescore";
import { Arrow, InningMark, StatusBadge } from "./primitives";

function FieldMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 460"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full opacity-40"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" className="text-band-ink">
        <path d="M 400 430 L 100 180 L 400 40 L 700 180 Z" />
        <path d="M 400 390 L 400 300" />
        <circle cx="400" cy="300" r="8" />
        <path d="M 100 180 A 330 330 0 0 0 700 180" />
        <path d="M 170 180 L 400 320 L 630 180" opacity="0.5" />
        <path d="M 40 460 L 400 430 L 760 460" opacity="0.6" />
      </g>
    </svg>
  );
}

function Telem({ entry }: { entry: PortalGame }) {
  if (isSummaryGame(entry)) {
    const score = scoreOf(entry);
    return (
      <div className="max-w-xs border-l-4 border-accent bg-band/95 p-3 text-band-ink shadow-overlay">
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-band-ink/20 pb-1">
          <span className="font-label-caps text-label-caps uppercase text-gold">
            Resultado oficial
          </span>
          <StatusBadge status={gameStatus(entry)} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-band-muted">Marcador</dt>
            <dd className="font-display text-title-lg">
              {score ? `${score.away}–${score.home}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-band-muted">Cobertura</dt>
            <dd className="font-display text-title-lg uppercase">{coverageLabel(entry)}</dd>
          </div>
        </dl>
        <p className="mt-2 border-t border-band-ink/20 pt-1 font-body text-body-sm text-band-muted">
          {SUMMARY_NOTE}
        </p>
      </div>
    );
  }

  const state = entry.state;
  const pitch = lastPitch(entry);
  const scoring = state !== null && state.status !== "scheduled";

  return (
    <div className="max-w-xs border-l-4 border-accent bg-band/95 p-3 text-band-ink shadow-overlay">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-band-ink/20 pb-1">
        <span className="font-label-caps text-label-caps uppercase text-gold">
          Telemetría del registro
        </span>
        <StatusBadge status={gameStatus(entry)} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <dt className="font-label-caps text-label-caps uppercase text-band-muted">Marcador</dt>
          <dd className="font-display text-title-lg">
            {scoring && state ? `${state.score.away}–${state.score.home}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-label-caps uppercase text-band-muted">Entrada</dt>
          <dd className="font-display text-title-lg uppercase">
            <InningMark state={state} closedInning={lastClosedInning(entry.events)} />
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-label-caps uppercase text-band-muted">Cuenta</dt>
          <dd className="font-display text-title-lg">
            {state && (state.status === "live" || state.status === "suspended")
              ? `${state.count.balls}-${state.count.strikes}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-label-caps text-label-caps uppercase text-band-muted">Último pitcheo</dt>
          <dd className="font-body text-body-sm font-semibold">
            {pitch && pitch.type === "pitch"
              ? `#${pitch.payload.pitchNo} · ${callLabel(pitch.payload.call)}`
              : "Sin registro"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function PortalFeaturedGame({ entry }: { entry: PortalGame | null }) {
  if (!entry) {
    return (
      <section className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        <div className="border border-line-strong bg-raised p-8 text-center">
          <p className="font-label-caps text-label-caps uppercase text-accent">
            Juego destacado
          </p>
          <h2 className="mt-2 font-display text-headline-md uppercase text-ink">
            Sin juegos registrados
          </h2>
          <p className="mx-auto mt-2 max-w-md font-body text-body-sm text-ink-muted">
            El acta se publicará cuando <span className="font-mono">olb-api</span> tenga un juego en
            el registro.
          </p>
        </div>
      </section>
    );
  }

  const play = lastBallInPlay(entry);
  const event = lastEvent(entry);
  const summary = isSummaryGame(entry);

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <article className="flex flex-col overflow-hidden border border-line-strong bg-raised lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-accent bg-band px-4 py-2 text-band-ink">
            <div className="flex items-center gap-3">
              <span className="bg-accent px-2 py-1 font-label-caps text-label-caps uppercase">
                Despacho oficial
              </span>
              <span className="font-label-caps text-label-caps uppercase text-band-muted">
                Juego {shortGameId(entry.game.id)}
              </span>
            </div>
            <span className="font-label-caps text-label-caps uppercase text-gold">
              Acta de partido · registro append-only
            </span>
          </div>

          <div className="relative min-h-[360px] overflow-hidden bg-band text-band-ink sm:min-h-[420px]">
            <div className="field-mark absolute inset-0" />
            <FieldMark />
            <div className="absolute inset-0 bg-gradient-to-t from-band via-band/70 to-band/10" />

            <div className="absolute left-4 top-4">
              <Telem entry={entry} />
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={gameStatus(entry)} />
                <span className="font-label-caps text-label-caps uppercase text-band-muted">
                  {teamAbbr(entry.game.awayTeam)} @ {teamAbbr(entry.game.homeTeam)} ·{" "}
                  {entry.game.awayTeam} vs {entry.game.homeTeam}
                </span>
              </div>
              <h1 className="max-w-3xl font-display text-headline-lg-mobile uppercase sm:text-headline-lg">
                {gameHeadline(entry)}
              </h1>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
            <PortalLinescore entry={entry} />

            <div className="border-l-4 border-band bg-surface-low p-3">
              <span className="block font-label-caps text-label-caps uppercase text-accent">
                {summary ? "Cobertura del juego" : "Última jugada registrada"}
              </span>
              <p className="mt-1 font-body text-body-md text-ink">
                {summary
                  ? SUMMARY_NOTE
                  : play && play.type === "ball_in_play"
                    ? play.payload.description?.trim() || `Código ${play.payload.code}`
                    : "Sin jugadas registradas"}
              </p>
              {!summary && play && play.type === "ball_in_play" ? (
                <p className="mt-1 font-body text-body-sm text-ink-muted">
                  {eventDetail(play) ?? `Código ${play.payload.code}`} · secuencia {play.seq}
                </p>
              ) : null}
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/games/${entry.game.id}`}
                  className="inline-flex items-center gap-2 border-b-2 border-transparent bg-band px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
                >
                  Acta oficial del juego <Arrow />
                </Link>
                <a
                  href="https://github.com/beny0102/olb-contract"
                  rel="noreferrer"
                  target="_blank"
                  className="inline-flex items-center gap-2 border border-band bg-transparent px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band transition-colors hover:bg-band hover:text-band-ink"
                >
                  Contrato olb.event/1 ↗
                </a>
              </div>
              <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                {summary
                  ? `${coverageLabel(entry)} · sin play-by-play`
                  : event
                    ? `${eventTitle(event)} · ${entry.events.length} eventos`
                    : "Sin eventos"}
              </span>
            </div>
          </div>
        </article>

        <div className="lg:col-span-4">
          <PortalGameRail entry={entry} />
        </div>
      </div>
    </section>
  );
}
