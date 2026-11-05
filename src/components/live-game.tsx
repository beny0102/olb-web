"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoxScorePanel } from "@/components/box-score";
import { EventFeed } from "@/components/event-feed";
import { PitchViewer } from "@/components/pitch-viewer";
import { Scoreboard } from "@/components/scoreboard";
import {
  clientBoxScore,
  clientEvents,
  clientState,
  gameStreamUrl,
} from "@/lib/client-api";
import { formatScheduledStart } from "@/lib/format";
import { mergeEvents, parseStreamMessage } from "@/lib/live-stream";
import type { BoxScore, Event, GameRecord, GameState } from "@/lib/types";

type Connection = "stream" | "polling" | "offline" | "demo";
type ViewerPhase = Connection | "final" | "scheduled";

const VIEWER_LABEL: Record<ViewerPhase, string> = {
  stream: "Actualizando en vivo",
  polling: "Actualizando cada 3 s",
  offline: "API sin respuesta, reintentando",
  demo: "Reproducción estática",
  final: "Acta cerrada",
  scheduled: "Juego programado",
};

const VIEWER_MARK: Record<ViewerPhase, string> = {
  stream: "bg-accent",
  polling: "bg-accent",
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
  const [connection, setConnection] = useState<Connection>(demo ? "demo" : "stream");
  const lastSeq = useRef(initialState.lastSeq);
  const eventsSeq = useRef(
    initialEvents.reduce((highest, event) => Math.max(highest, event.seq), -1),
  );
  const status = useRef(initialState.status);

  useEffect(() => {
    if (demo) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let timer: number | null = null;
    let retryTimer: number | null = null;
    let polling = false;
    let eventsLoading = false;

    const loadBoxScore = async () => {
      try {
        const box = await clientBoxScore(game.id);
        if (!cancelled) setBoxScore(box);
      } catch {
        // The state read was good; keep the last box score rather than blanking it.
      }
    };

    const syncEvents = async () => {
      if (cancelled || eventsLoading) return;
      const target = lastSeq.current;
      if (target <= eventsSeq.current) return;

      eventsLoading = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }

      try {
        const fresh = await clientEvents(game.id, eventsSeq.current + 1);
        if (cancelled) return;
        if (fresh.length > 0) setEvents((previous) => mergeEvents(previous, fresh));
        eventsSeq.current = Math.max(eventsSeq.current, target);
      } catch {
        // Keep the cursor behind so the retry re-reads the missed range.
        if (!cancelled) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            void syncEvents();
          }, 3000);
        }
      } finally {
        eventsLoading = false;
        if (!cancelled && retryTimer === null && lastSeq.current > eventsSeq.current) {
          void syncEvents();
        }
      }
    };

    const applyState = (next: GameState, channel: "stream" | "polling") => {
      const previousSeq = lastSeq.current;
      const previousStatus = status.current;
      const advanced = next.lastSeq > previousSeq;

      lastSeq.current = Math.max(previousSeq, next.lastSeq);
      status.current = next.status;
      setState(next);
      setConnection(channel);

      void syncEvents();
      if (advanced || next.status !== previousStatus) void loadBoxScore();
    };

    const poll = async () => {
      if (document.hidden) return;
      try {
        const snapshot = await clientState(game.id);
        if (!cancelled) applyState(snapshot, "polling");
      } catch {
        if (!cancelled) setConnection("offline");
      }
    };

    const startPolling = () => {
      if (polling || cancelled) return;
      polling = true;
      setConnection("polling");
      void poll();
      timer = window.setInterval(poll, 3000);
    };

    const startStream = () => {
      source = new EventSource(gameStreamUrl(game.id));
      source.onopen = () => {
        if (!cancelled) setConnection("stream");
      };
      source.onmessage = (message) => {
        if (cancelled) return;
        const parsed = parseStreamMessage(message.data);
        if (parsed) applyState(parsed.state, "stream");
      };
      source.onerror = () => {
        if (cancelled) return;
        source?.close();
        source = null;
        startPolling();
      };
    };

    startStream();
    void syncEvents();

    return () => {
      cancelled = true;
      source?.close();
      if (timer !== null) window.clearInterval(timer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
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
        : connection;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 font-label-caps text-label-caps uppercase ${
            phase === "offline" ? "text-accent" : "text-ink-muted"
          }`}
        >
          <span
            className={`size-2 ${VIEWER_MARK[phase]} ${phase === "stream" ? "animate-pulse" : ""}`}
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
