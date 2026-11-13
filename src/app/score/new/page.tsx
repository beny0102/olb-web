"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ScorerShell } from "@/components/scorer/scorer-shell";
import { ApiError, createGame } from "@/lib/scorer/api";
import { DEFAULT_RULES } from "@/lib/scorer/rules";
import { localStore } from "@/lib/scorer/store";

const FIELD_CLASS =
  "mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink placeholder:text-ink-muted focus:border-accent";

const LABEL_CLASS =
  "block font-label-caps text-label-caps uppercase text-ink-muted";

export default function NewGamePage() {
  const router = useRouter();
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [venue, setVenue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    let start: string | null = null;
    if (scheduledStart) {
      const date = new Date(scheduledStart);
      if (Number.isNaN(date.getTime())) {
        setError("La fecha y hora no son válidas.");
        return;
      }
      start = date.toISOString();
    }

    setSubmitting(true);
    try {
      const game = await createGame({
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        scheduledStart: start,
        venue: venue.trim() || null,
      });
      await localStore().putGame({
        id: game.id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        scheduledStart: game.scheduledStart,
        venue: game.venue,
        createdAt: game.createdAt,
        lineups: { home: null, away: null },
        rules: structuredClone(DEFAULT_RULES),
      });
      router.push(`/score/${game.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos crear el juego. Inténtalo de nuevo.",
      );
      setSubmitting(false);
    }
  }

  return (
    <ScorerShell
      title="Nuevo juego"
      subtitle="Programa el partido y luego carga las alineaciones."
      backHref="/score"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="border border-line-strong bg-raised"
      >
        <div className="space-y-space-md px-space-md py-space-md">
          <label className={LABEL_CLASS}>
            Equipo local
            <input
              type="text"
              value={homeTeam}
              onChange={(event) => setHomeTeam(event.target.value)}
              required
              maxLength={120}
              placeholder="Ej. Tiburones"
              className={FIELD_CLASS}
            />
          </label>

          <label className={LABEL_CLASS}>
            Equipo visitante
            <input
              type="text"
              value={awayTeam}
              onChange={(event) => setAwayTeam(event.target.value)}
              required
              maxLength={120}
              placeholder="Ej. Marlins"
              className={FIELD_CLASS}
            />
          </label>

          <label className={LABEL_CLASS}>
            Fecha y hora (opcional)
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className={LABEL_CLASS}>
            Sede (opcional)
            <input
              type="text"
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
              maxLength={200}
              placeholder="Ej. Estadio Centenario"
              className={FIELD_CLASS}
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-md text-ink"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-space-sm border-t border-line px-space-md py-space-md">
          <button
            type="button"
            onClick={() => router.push("/score")}
            className="inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-lg font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-60"
          >
            {submitting ? "Creando…" : "Crear juego"}
          </button>
        </div>
      </form>
    </ScorerShell>
  );
}
