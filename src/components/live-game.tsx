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

const CONNECTION_LABEL: Record<Connection, string> = {
  live: "Actualizando cada 3 s",
  offline: "API sin respuesta, reintentando",
  demo: "Reproducción estática",
};

function ScheduledGame({ game }: { game: GameRecord }) {
  const start = formatScheduledStart(game.scheduledStart);
  const venue = game.venue?.trim() || null;

  return (
    <section className="panel p-6 sm:p-8" aria-label="Juego programado">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Juego programado
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
        {game.awayTeam} <span className="text-muted">vs</span> {game.homeTeam}
      </h1>

      <p className="mt-5 border-l-2 border-ember pl-3 text-sm font-medium text-chalk">
        Aún no comienza
      </p>
      <p className="mt-1 max-w-xl pl-3 text-sm leading-relaxed text-muted">
        El marcador y la línea de anotación aparecerán cuando el acta registre el primer evento.
      </p>

      <dl className="mt-6 grid gap-x-6 gap-y-3 border-t border-nightline pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-muted">Inicio</dt>
          <dd className="mt-1 text-chalk">{start ?? "Por confirmar"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-widest text-muted">Sede</dt>
          <dd className="mt-1 text-chalk">{venue ?? "Por confirmar"}</dd>
        </div>
      </dl>
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 font-mono text-[11px] ${
            connection === "offline" ? "text-ember" : "text-muted"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              connection === "offline"
                ? "bg-ember"
                : connection === "demo"
                  ? "bg-muted"
                  : "animate-pulse bg-grass"
            }`}
          />
          {CONNECTION_LABEL[connection]}
        </span>
        <span className="font-mono text-[11px] text-muted">seq {state.lastSeq}</span>
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

            <section className="panel p-5" aria-label="Detalles técnicos">
              <h2 className="text-sm font-semibold">Detalles</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted">Contrato</dt>
                  <dd className="mt-1 font-mono text-xs">olb.event/1</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted">Eventos</dt>
                  <dd className="mt-1 font-mono text-xs">{events.length}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted">Último seq</dt>
                  <dd className="mt-1 font-mono text-xs">{state.lastSeq}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-widest text-muted">Fuente</dt>
                  <dd className="mt-1 font-mono text-xs">{demo ? "demo estática" : "olb-api"}</dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-nightline pt-4 text-xs leading-relaxed text-muted">
                La trayectoria del pitcheo es sintética hasta que{" "}
                <span className="font-mono">olb-vision</span> entregue tracks calibrados. El
                marcador y el conteo sí salen del registro de eventos.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
