"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoxScorePanel } from "@/components/box-score";
import { EventFeed } from "@/components/event-feed";
import { PitchViewer } from "@/components/pitch-viewer";
import { Scoreboard } from "@/components/scoreboard";
import { clientBoxScore, clientEvents, clientState } from "@/lib/client-api";
import { formatScheduledStart } from "@/lib/format";
import type { BoxScore, Event, GameRecord, GameState } from "@/lib/types";

type Connection = "live" | "offline" | "demo";
type ViewerPhase = Connection | "final" | "scheduled";

const VIEWER_LABEL: Record<ViewerPhase, string> = {
  live: "Actualizando cada 3 s",
  offline: "API sin respuesta, reintentando",
  demo: "Reproducción estática",
  final: "Acta cerrada",
  scheduled: "Juego programado",
};

const VIEWER_MARK: Record<ViewerPhase, string> = {
  live: "bg-accent",
  offline: "bg-accent",
  demo: "bg-ink-muted",
  final: "bg-ink-muted",
  scheduled: "bg-ink-muted",
};

function ScheduledGame({ game }: { game: GameRecord }) {
  const start = formatScheduledStart(game.scheduledStart);
  const venue = game.venue?.trim() || null;

  return (
    <section className="border border-line-strong bg-raised" aria-label="Juego programado">
      <header className="border-b-4 border-band bg-band px-6 py-4 text-band-ink">
        <p className="font-label-caps text-label-caps uppercase text-band-muted">
          Juego programado
        </p>
        <h1 className="mt-1 font-display text-headline-sm uppercase text-band-ink sm:text-headline-md">
          {game.awayTeam} <span className="text-band-muted">vs</span> {game.homeTeam}
        </h1>
      </header>

      <div className="px-6 py-6 sm:px-8 sm:py-8">
        <p className="border-l-2 border-accent pl-3 font-body text-body-md font-semibold text-ink">
          Aún no comienza
        </p>
        <p className="mt-1 max-w-xl pl-3 font-body text-body-sm leading-relaxed text-ink-muted">
          El marcador y la línea de anotación aparecerán cuando el acta registre el primer evento.
        </p>

        <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Inicio</dt>
            <dd className="mt-1 font-body text-body-md text-ink">{start ?? "Por confirmar"}</dd>
          </div>
          <div>
            <dt className="font-label-caps text-label-caps uppercase text-ink-muted">Sede</dt>
            <dd className="mt-1 font-body text-body-md text-ink">{venue ?? "Por confirmar"}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function LiveGame({
  game,
  initialState,
  initialEvents,
  initialBoxScore = null,
  demo = false,
}: {
  game: GameRecord;
  initialState: GameState;
  initialEvents: Event[];
  initialBoxScore?: BoxScore | null;
  demo?: boolean;
}) {
  const [state, setState] = useState<GameState>(initialState);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [boxScore, setBoxScore] = useState<BoxScore | null>(initialBoxScore);
  const [connection, setConnection] = useState<Connection>(demo ? "demo" : "live");
  const lastSeq = useRef(initialState.lastSeq);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;

    const tick = async () => {
      if (document.hidden) return;
      try {
        const [fresh, snapshot, box] = await Promise.all([
          clientEvents(game.id, lastSeq.current + 1),
          clientState(game.id),
          clientBoxScore(game.id),
        ]);
        if (cancelled) return;

        if (fresh.length > 0) {
          setEvents((previous) => {
            const known = new Set(previous.map((event) => event.id));
            return [...previous, ...fresh.filter((event) => !known.has(event.id))];
          });
          lastSeq.current = fresh[fresh.length - 1]!.seq;
        }

        setState(snapshot);
        setBoxScore(box);
        setConnection("live");
      } catch {
        if (!cancelled) setConnection("offline");
      }
    };

    const timer = window.setInterval(tick, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [game.id, demo]);

  const lastPitch = useMemo(() => {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]!;
      if (event.type === "pitch") return event;
    }
    return null;
  }, [events]);

  const phase: ViewerPhase =
    connection === "demo" || connection === "offline"
      ? connection
      : state.status === "final" || state.status === "scheduled"
        ? state.status
        : "live";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 font-label-caps text-label-caps uppercase ${
            phase === "offline" ? "text-accent" : "text-ink-muted"
          }`}
        >
          <span
            className={`size-2 ${VIEWER_MARK[phase]} ${phase === "live" ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
          {VIEWER_LABEL[phase]}
        </span>
        <span className="font-label-caps text-label-caps uppercase text-ink-muted">
          seq {state.lastSeq}
        </span>
      </div>

      {state.status === "scheduled" ? (
        <ScheduledGame game={game} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <Scoreboard game={game} state={state} demo={demo} />
            {boxScore && (state.status === "live" || state.status === "final") ? (
              <BoxScorePanel game={game} boxScore={boxScore} />
            ) : null}
            <EventFeed events={events} />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <PitchViewer pitch={lastPitch} />

            <section className="border border-line-strong bg-raised p-5" aria-label="Detalles técnicos">
              <h2 className="font-display text-title-md uppercase text-ink">Detalles</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="font-label-caps text-label-caps uppercase text-ink-muted">
                    Contrato
                  </dt>
                  <dd className="mt-1 font-mono text-body-sm text-ink">olb.event/1</dd>
                </div>
                <div>
                  <dt className="font-label-caps text-label-caps uppercase text-ink-muted">
                    Eventos
                  </dt>
                  <dd className="mt-1 font-display text-tabular-stats text-ink">{events.length}</dd>
                </div>
                <div>
                  <dt className="font-label-caps text-label-caps uppercase text-ink-muted">
                    Último seq
                  </dt>
                  <dd className="mt-1 font-display text-tabular-stats text-ink">{state.lastSeq}</dd>
                </div>
                <div>
                  <dt className="font-label-caps text-label-caps uppercase text-ink-muted">
                    Fuente
                  </dt>
                  <dd className="mt-1 font-mono text-body-sm text-ink">
                    {demo ? "demo estática" : "olb-api"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-line pt-4 font-body text-body-sm leading-relaxed text-ink-muted">
                La trayectoria del pitcheo es sintética hasta que{" "}
                <span className="font-mono text-ink">olb-vision</span> entregue tracks calibrados.
                El marcador y el conteo sí salen del registro de eventos.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
