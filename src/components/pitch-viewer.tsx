"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { callLabel } from "@/lib/format";
import { buildPitch } from "@/lib/pitch-track";
import type { Event } from "@/lib/types";

const PitchScene = dynamic(() => import("./pitch-scene"), {
  ssr: false,
  loading: () => (
    <div role="status" className="absolute inset-0 grid place-items-center bg-band">
      <span className="font-label-caps text-label-caps uppercase text-band-ink/70">
        Cargando escena…
      </span>
    </div>
  ),
});

type PitchEvent = Extract<Event, { type: "pitch" }>;

export function PitchViewer({ pitch }: { pitch: PitchEvent | null }) {
  const [replay, setReplay] = useState(0);
  const track = useMemo(() => (pitch ? buildPitch(pitch.payload.call) : null), [pitch]);

  useEffect(() => {
    if (pitch) setReplay((value) => value + 1);
  }, [pitch?.id]);

  if (!pitch || !track) {
    return (
      <section className="overflow-hidden border border-line-strong bg-raised" aria-label="Visor de pitcheo">
        <header className="border-b border-line px-5 py-3">
          <h2 className="font-display text-title-md uppercase text-ink">Último lanzamiento</h2>
        </header>
        <div className="grid aspect-[4/3] place-items-center bg-surface-low">
          <p className="font-label-caps text-label-caps uppercase text-ink-muted">
            Sin lanzamientos registrados
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden border border-line-strong bg-raised" aria-label="Visor de pitcheo">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-title-md uppercase text-ink">Último lanzamiento</h2>
        <span className="border border-line-strong px-2 py-0.5 font-label-caps text-label-caps uppercase text-ink-muted">
          Trayectoria sintética
        </span>
      </header>

      <div className="relative aspect-[4/3] bg-band">
        <PitchScene samples={track.samples} replayKey={replay} />

        <div className="pointer-events-none absolute left-4 top-4">
          <p className="score-num font-display text-headline-md text-band-ink">
            {track.speedKph}
            <span className="ml-1 font-label-caps text-label-caps uppercase text-band-ink/70">
              km/h
            </span>
          </p>
          <p className="font-body text-body-sm text-band-ink/70">{track.breakCm} cm de break</p>
        </div>

        <button
          type="button"
          onClick={() => setReplay((value) => value + 1)}
          className="absolute bottom-3 right-3 border border-band-ink/20 bg-band px-3 py-1.5 font-label-caps text-label-caps uppercase text-band-ink transition-colors hover:border-accent"
        >
          ↻ Repetir
        </button>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 font-body text-body-sm text-ink-muted">
        <span>
          {pitch
            ? `${callLabel(pitch.payload.call)} · ${pitch.payload.count.balls}-${pitch.payload.count.strikes}`
            : "Sin lanzamientos todavía"}
        </span>
        <span className="font-label-caps text-label-caps uppercase">vista de receptor</span>
      </footer>
    </section>
  );
}
