import Link from "next/link";
import {
  callLabel,
  eventDetail,
  eventTitle,
  formatScheduledStart,
  inningLabel,
  outsLabel,
  sourceLabel,
} from "@/lib/format";
import {
  coverageLabel,
  formatTime,
  gameStatus,
  isSummaryGame,
  lastClosedInning,
  lastEvent,
  lastPitch,
  scoreOf,
  SUMMARY_NOTE,
  teamAbbr,
  type PortalGame,
} from "@/lib/league";
import type { GameStatus } from "@/lib/types";
import { Arrow, StatusBadge } from "./primitives";

function baseLabel(entry: PortalGame): string {
  const bases = entry.state?.bases;
  if (!bases) return "Sin estado de bases";
  const occupied: string[] = [];
  if (bases.first) occupied.push("1.ª");
  if (bases.second) occupied.push("2.ª");
  if (bases.third) occupied.push("3.ª");
  return occupied.length > 0 ? `Bases: ${occupied.join(", ")}` : "Bases vacías";
}

function railSuffix(status: GameStatus, entry: PortalGame): string {
  if (isSummaryGame(entry)) return `Final · ${coverageLabel(entry)}`;
  const state = entry.state;
  switch (status) {
    case "live":
      return state ? `${inningLabel(state)} · ${outsLabel(state.outs)}` : "Sin jugadas";
    case "final": {
      const inning = lastClosedInning(entry.events) ?? state?.inning;
      if (inning == null) return "Final";
      return `Final · ${inning === 1 ? "1 entrada" : `${inning} entradas`}`;
    }
    case "suspended":
      return "Suspendido";
    case "scheduled":
      return "Programado";
    default:
      return "Incomparecencia";
  }
}

function syntheticPoint(pitchNo: number): { x: number; y: number } {
  const seed = pitchNo * 37 + 11;
  return {
    x: 58 + (seed % 84),
    y: 42 + ((seed * 7) % 96),
  };
}

function StrikeZone({ pitchNo, label }: { pitchNo: number | null; label: string }) {
  const point = syntheticPoint(pitchNo ?? 1);
  return (
    <div className="relative flex h-56 w-full items-center justify-center overflow-hidden border border-line bg-surface-low p-4">
      <svg viewBox="0 0 200 200" className="h-full w-full max-w-[190px]" role="img" aria-label={label}>
        <rect x="50" y="30" width="100" height="120" fill="none" stroke="currentColor" className="text-band" strokeWidth="2" />
        <line x1="50" x2="150" y1="70" y2="70" stroke="currentColor" strokeDasharray="2 2" className="text-line-strong" />
        <line x1="50" x2="150" y1="110" y2="110" stroke="currentColor" strokeDasharray="2 2" className="text-line-strong" />
        <line x1="83.3" x2="83.3" y1="30" y2="150" stroke="currentColor" strokeDasharray="2 2" className="text-line-strong" />
        <line x1="116.6" x2="116.6" y1="30" y2="150" stroke="currentColor" strokeDasharray="2 2" className="text-line-strong" />
        <polygon points="50,175 150,175 150,185 100,195 50,185" className="fill-line-strong" opacity="0.5" />
        <line
          x1="100"
          y1="190"
          x2={point.x}
          y2={point.y}
          stroke="currentColor"
          strokeDasharray="4 3"
          strokeWidth="1.5"
          className="text-accent"
        />
        <circle cx={point.x} cy={point.y} r="7" className="fill-accent" />
        <circle cx={point.x} cy={point.y} r="11" fill="none" stroke="currentColor" strokeWidth="1" className="text-accent" opacity="0.4" />
      </svg>
      <span className="absolute bottom-2 right-2 bg-accent px-1.5 py-1 text-right text-band-ink">
        <span className="block font-label-caps text-label-caps uppercase">
          Trayectoria sintética
        </span>
        <span className="block font-label-caps text-label-caps uppercase text-band-ink/80">
          Sin track de visión
        </span>
      </span>
    </div>
  );
}

export function PortalGameRail({ entry }: { entry: PortalGame }) {
  const status = gameStatus(entry);
  const state = entry.state;
  const summary = isSummaryGame(entry);
  const score = scoreOf(entry);
  const pitch = lastPitch(entry);
  const event = lastEvent(entry);
  const pitchLabel =
    pitch && pitch.type === "pitch"
      ? `Pitcheo #${pitch.payload.pitchNo} · ${callLabel(pitch.payload.call)}`
      : "Sin lanzamientos registrados";
  const pitchNo = pitch && pitch.type === "pitch" ? pitch.payload.pitchNo : null;
  const pitchType = pitch && pitch.type === "pitch" ? pitch.payload.pitchType : undefined;

  return (
    <aside
      aria-label="Estado del juego destacado"
      className="flex h-full flex-col overflow-hidden border border-line-strong bg-raised"
    >
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 text-band-ink ${status === "live" ? "bg-accent" : "bg-band"}`}
      >
        <span className="font-label-caps text-label-caps uppercase">
          {status === "live" ? "Turno en vivo" : "Acta del partido"}
        </span>
        <span className="font-label-caps text-label-caps uppercase">
          {railSuffix(status, entry)}
        </span>
      </div>

      <div className="border-b border-line bg-surface-low p-3">
        <div className="flex items-center justify-between gap-2 text-center">
          <div className="flex-1">
            <span className="block font-display text-title-md uppercase text-ink-muted">
              {teamAbbr(entry.game.awayTeam)}
            </span>
            <span className="mt-1 block font-display text-headline-md text-ink">
              {score ? score.away : "—"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 px-2">
            <StatusBadge
              status={status}
              suffix={
                !summary && state && state.status !== "scheduled"
                  ? String(
                      state.status === "final"
                        ? (lastClosedInning(entry.events) ?? state.inning)
                        : state.inning,
                    )
                  : null
              }
            />
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              {entry.game.homeTeam}
            </span>
          </div>
          <div className="flex-1">
            <span className="block font-display text-title-md uppercase text-accent">
              {teamAbbr(entry.game.homeTeam)}
            </span>
            <span className="mt-1 block font-display text-headline-md text-accent">
              {score ? score.home : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {summary ? (
          <div className="border-l-4 border-accent bg-surface-low p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-caps text-label-caps uppercase text-accent">
                Resultado final
              </span>
              <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                {coverageLabel(entry)}
              </span>
            </div>
            <p className="mt-1 font-display text-title-lg uppercase text-ink">
              {teamAbbr(entry.game.awayTeam)} {score ? score.away : "—"}–
              {score ? score.home : "—"} {teamAbbr(entry.game.homeTeam)}
            </p>
            <p className="mt-2 border-t border-line pt-2 font-body text-body-sm text-ink-muted">
              {SUMMARY_NOTE}
            </p>
          </div>
        ) : null}

        {!summary && status === "live" ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-caps text-label-caps uppercase text-ink">
                Zona de strike
              </span>
              <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                {pitchLabel}
              </span>
            </div>

            <StrikeZone pitchNo={pitchNo} label={`Zona de strike con una trayectoria sintética para el pitcheo ${pitchNo ?? "sin registro"}.`} />

            <dl className="grid grid-cols-2 gap-2">
              <div className="border-l-2 border-line-strong bg-surface-low p-2">
                <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Cuenta</dt>
                <dd className="font-display text-title-lg text-ink">
                  {state ? `${state.count.balls}-${state.count.strikes}` : "—"}
                </dd>
              </div>
              <div className="border-l-2 border-accent bg-surface-low p-2">
                <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Outs</dt>
                <dd className="font-display text-title-lg text-ink">
                  {state ? outsLabel(state.outs) : "—"}
                </dd>
              </div>
              <div className="col-span-2 border-l-2 border-line-strong bg-surface-low p-2">
                <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Bases</dt>
                <dd className="font-body text-body-sm font-semibold text-ink">{baseLabel(entry)}</dd>
              </div>
            </dl>
          </>
        ) : null}

        {!summary && (status === "final" || status === "forfeit") ? (
          <div className="border-l-4 border-band bg-surface-low p-3">
            <span className="block font-label-caps text-label-caps uppercase text-accent">
              Resultado final
            </span>
            <p className="mt-1 font-display text-title-lg uppercase text-ink">
              {teamAbbr(entry.game.awayTeam)} {score ? score.away : "—"}–
              {score ? score.home : "—"} {teamAbbr(entry.game.homeTeam)}
            </p>
            <dl className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-2">
              <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Entradas</dt>
              <dd className="font-display text-title-lg text-ink">
                {lastClosedInning(entry.events) ?? state?.inning ?? "—"}
              </dd>
            </dl>
          </div>
        ) : null}

        {!summary && status === "scheduled" ? (
          <dl className="grid gap-2">
            <div className="border-l-2 border-line-strong bg-surface-low p-2">
              <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Inicio</dt>
              <dd className="font-body text-body-sm font-semibold text-ink">
                {formatScheduledStart(entry.game.scheduledStart) ?? "Por confirmar"}
              </dd>
            </div>
            <div className="border-l-2 border-line-strong bg-surface-low p-2">
              <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Sede</dt>
              <dd className="font-body text-body-sm font-semibold text-ink">
                {entry.game.venue ?? "Por confirmar"}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="border-t border-line pt-2">
          <span className="font-label-caps text-label-caps uppercase text-ink-muted">
            Último evento
          </span>
          {summary ? (
            <p className="mt-0.5 font-body text-body-sm text-ink-muted">{SUMMARY_NOTE}</p>
          ) : (
            <>
              <p className="mt-0.5 font-display text-title-lg uppercase text-ink">
                {event ? eventTitle(event) : "Sin eventos registrados"}
              </p>
              {event ? (
                <p className="mt-0.5 font-body text-body-sm text-ink-muted">
                  {eventDetail(event) ?? `Secuencia ${event.seq}`} · {formatTime(event.occurredAt)} · {sourceLabel(event.source)}
                </p>
              ) : null}
              {pitchType ? (
                <p className="mt-0.5 font-body text-body-sm text-ink-muted">Tipo registrado: {pitchType}</p>
              ) : null}
            </>
          )}
        </div>

        <Link
          href={`/games/${entry.game.id}`}
          className="mt-auto inline-flex w-full items-center justify-center gap-2 border-b-2 border-transparent bg-band px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
        >
          Ver expediente completo <Arrow />
        </Link>
      </div>
    </aside>
  );
}
