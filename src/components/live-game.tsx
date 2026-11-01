"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventFeed } from "@/components/event-feed";
import { PitchViewer } from "@/components/pitch-viewer";
import { Scoreboard } from "@/components/scoreboard";
import { clientEvents, clientState } from "@/lib/client-api";
import type { Event, GameRecord, GameState } from "@/lib/types";

type Connection = "live" | "offline" | "demo";

const CONNECTION_LABEL: Record<Connection, string> = {
  live: "Actualizando cada 3 s",
  offline: "API sin respuesta, reintentando",
  demo: "Reproducción estática",
};

export function LiveGame({
  game,
  initialState,
  initialEvents,
  demo = false,
}: {
  game: GameRecord;
  initialState: GameState;
  initialEvents: Event[];
  demo?: boolean;
}) {
  const [state, setState] = useState<GameState>(initialState);
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [connection, setConnection] = useState<Connection>(demo ? "demo" : "live");
  const lastSeq = useRef(initialState.lastSeq);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;

    const tick = async () => {
      if (document.hidden) return;
      try {
        const fresh = await clientEvents(game.id, lastSeq.current + 1);
        const snapshot = await clientState(game.id);
        if (cancelled) return;

        if (fresh.length > 0) {
          setEvents((previous) => {
            const known = new Set(previous.map((event) => event.id));
            return [...previous, ...fresh.filter((event) => !known.has(event.id))];
          });
          lastSeq.current = fresh[fresh.length - 1]!.seq;
        }

        setState(snapshot);
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

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <Scoreboard game={game} state={state} demo={demo} />
          <EventFeed events={events} />
        </div>

        <div className="flex flex-col gap-6">
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
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">
              La trayectoria del pitcheo es sintética hasta que <span className="font-mono">olb-vision</span>{" "}
              entregue tracks calibrados. El marcador y el conteo sí salen del registro de eventos.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
