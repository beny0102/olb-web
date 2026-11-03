"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { callLabel } from "@/lib/format";
import { buildPitch } from "@/lib/pitch-track";
import type { Event } from "@/lib/types";

const PitchScene = dynamic(() => import("./pitch-scene"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="absolute inset-0 grid place-items-center bg-[#07100b]"
    >
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
        Cargando escena…
      </span>
    </div>
  ),
});

type PitchEvent = Extract<Event, { type: "pitch" }>;

export function PitchViewer({ pitch }: { pitch: PitchEvent | null }) {
  const [replay, setReplay] = useState(0);
  const call = pitch?.payload.call ?? "S";
  const track = useMemo(() => buildPitch(call), [call]);

  useEffect(() => {
    if (pitch) setReplay((value) => value + 1);
  }, [pitch?.id]);

  return (
    <section className="panel overflow-hidden" aria-label="Visor de pitcheo">
      <header className="flex items-center justify-between gap-3 border-b border-nightline px-5 py-3">
        <h2 className="text-sm font-semibold">Último lanzamiento</h2>
        <span className="rounded border border-nightline px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          Trayectoria sintética
        </span>
      </header>

      <div className="relative aspect-[4/3] bg-[#07100b]">
        <PitchScene samples={track.samples} replayKey={replay} />

        <div className="pointer-events-none absolute left-4 top-4 font-mono">
          <p className="score-num text-3xl font-semibold">
            {track.speedKph}
            <span className="ml-1 text-xs font-normal text-muted">km/h</span>
          </p>
          <p className="text-xs text-muted">{track.breakCm} cm de break</p>
        </div>

        <button
          type="button"
          onClick={() => setReplay((value) => value + 1)}
          className="absolute bottom-3 right-3 rounded-md border border-chalk/30 bg-night/70 px-3 py-1.5 font-mono text-xs text-chalk backdrop-blur transition-colors hover:border-ember hover:text-ember"
        >
          ↻ Repetir
        </button>
      </div>

      <footer className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-muted">
        <span>
          {pitch
            ? `${callLabel(pitch.payload.call)} · ${pitch.payload.count.balls}-${pitch.payload.count.strikes}`
            : "Sin lanzamientos todavía"}
        </span>
        <span className="font-mono">vista de receptor</span>
      </footer>
    </section>
  );
}
