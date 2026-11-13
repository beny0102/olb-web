"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OutcomePad } from "@/components/scorer/outcome-pad";
import { PitchPad } from "@/components/scorer/pitch-pad";
import { Scoreboard } from "@/components/scorer/scoreboard";
import { ScorerShell } from "@/components/scorer/scorer-shell";
import {
  ApiError,
  createProposal,
  getGame,
  getGameState,
  type ApiGame,
  type ProposalPayload,
} from "@/lib/scorer/api";
import { VIEWER_URL } from "@/lib/scorer/config";
import type { GameState } from "@/lib/scorer/fold";
import type { OutcomeCode } from "@/lib/scorer/scoring";

const NAME_KEY = "olb-scorer-verifier-name";
const DEFAULT_AUTHOR = "Verificador";

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-lg font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent";

function isFinished(status: string): boolean {
  return status === "final" || status === "forfeit" || status === "suspended";
}

function messageFor(caught: unknown): string {
  if (caught instanceof ApiError) return caught.message;
  return "No pudimos enviar la propuesta. Inténtalo de nuevo.";
}

/**
 * The spotter's page: it reads the API projection, never the local log, and
 * every tap becomes a proposal the writer must accept before it is game data.
 */
export default function VerifierPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";

  const [game, setGame] = useState<ApiGame | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [author, setAuthor] = useState(DEFAULT_AUTHOR);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showOutcomes, setShowOutcomes] = useState(false);
  const sentTimer = useRef<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(NAME_KEY);
    if (stored !== null && stored.trim() !== "") setAuthor(stored);
  }, []);

  useEffect(() => {
    return () => {
      if (sentTimer.current !== null) window.clearTimeout(sentTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError(null);

    void (async () => {
      try {
        const [remote, projection] = await Promise.all([getGame(id), getGameState(id)]);
        if (cancelled) return;
        setGame(remote);
        setState(projection);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setNotFound(true);
        } else {
          setError(messageFor(caught));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  useEffect(() => {
    if (!id || notFound) return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      if (!navigator.onLine) return;
      void (async () => {
        try {
          const projection = await getGameState(id);
          if (cancelled) return;
          setState(projection);
          setError(null);
        } catch (caught) {
          if (cancelled) return;
          if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
        }
      })();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, notFound]);

  const closed = state !== null && isFinished(state.status);

  function changeAuthor(value: string): void {
    setAuthor(value);
    window.localStorage.setItem(NAME_KEY, value);
  }

  async function send(payload: ProposalPayload): Promise<void> {
    if (!game || sending || closed) return;
    setSending(true);
    setError(null);

    try {
      await createProposal(game.id, payload, author.trim() || DEFAULT_AUTHOR);
      setSent(true);
      if (sentTimer.current !== null) window.clearTimeout(sentTimer.current);
      sentTimer.current = window.setTimeout(() => setSent(false), 2000);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setSending(false);
    }
  }

  function sendOutcome(code: OutcomeCode): void {
    // The proposal vocabulary is deliberately smaller than the event contract.
    if (code === "DP" || code === "SAC") return;
    setShowOutcomes(false);
    void send({ kind: "outcome", code });
  }

  if (loading) {
    return (
      <ScorerShell title="Verificador" backHref="/score" backLabel="Inicio" gameId={id || undefined}>
        <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
          Abriendo el juego…
        </p>
      </ScorerShell>
    );
  }

  if (notFound) {
    return (
      <ScorerShell title="Verificador" backHref="/score" backLabel="Inicio" gameId={id || undefined}>
        <div className="border border-line-strong bg-raised px-space-md py-space-md">
          <p className="font-display text-headline-sm text-ink">
            El anotador aún no ha sincronizado este juego
          </p>
          <p className="mt-space-xs font-body text-body-md text-ink-muted">
            Abre el enlace cuando el anotador haya subido el inicio del juego.
          </p>
          <div className="mt-space-md flex flex-wrap gap-space-sm">
            <button
              type="button"
              className={primaryButton}
              onClick={() => setAttempt((current) => current + 1)}
            >
              Reintentar
            </button>
            <Link href="/score" className={secondaryButton}>
              Volver
            </Link>
          </div>
        </div>
      </ScorerShell>
    );
  }

  if (!game || !state) {
    return (
      <ScorerShell title="Verificador" backHref="/score" backLabel="Inicio" gameId={id || undefined}>
        <div className="border border-line-strong bg-raised px-space-md py-space-md">
          <p className="font-display text-headline-sm text-ink">
            {error ?? "No pudimos abrir ese juego."}
          </p>
          <div className="mt-space-md flex flex-wrap gap-space-sm">
            <button
              type="button"
              className={primaryButton}
              onClick={() => setAttempt((current) => current + 1)}
            >
              Reintentar
            </button>
            <Link href="/score" className={secondaryButton}>
              Volver
            </Link>
          </div>
        </div>
      </ScorerShell>
    );
  }

  const half = state.half === "top" ? "Alta" : "Baja";
  const subtitle = closed ? "Juego cerrado" : `Modo verificador · Entrada ${state.inning} · ${half}`;

  return (
    <ScorerShell
      title={`${game.awayTeam} @ ${game.homeTeam}`}
      subtitle={subtitle}
      backHref="/score"
      backLabel="Inicio"
      gameId={game.id}
    >
      <div className="space-y-space-md">
        {error ? (
          <p
            role="alert"
            className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-md text-ink"
          >
            {error}
          </p>
        ) : null}

        <Scoreboard
          state={state}
          awayTeam={game.awayTeam}
          homeTeam={game.homeTeam}
          batter={null}
          pitcher={null}
        />

        <div>
          <label
            htmlFor="verifier-name"
            className="font-label-caps text-label-caps uppercase text-ink-muted"
          >
            Tu nombre
          </label>
          <input
            id="verifier-name"
            type="text"
            value={author}
            onChange={(event) => changeAuthor(event.target.value)}
            maxLength={60}
            disabled={closed}
            className="mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-raised px-space-sm font-body text-body-md text-ink disabled:opacity-60"
          />
        </div>

        {closed ? (
          <p
            role="status"
            className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-display text-headline-sm text-ink"
          >
            Juego cerrado
          </p>
        ) : (
          <p className="font-body text-body-sm text-ink-muted">
            Tus propuestas no cambian el marcador hasta que el anotador las acepte.
          </p>
        )}

        {sent ? (
          <p
            role="status"
            className="border-l-4 border-gold bg-surface-low px-space-sm py-space-sm font-body text-body-md text-ink"
          >
            Propuesta enviada
          </p>
        ) : null}

        <div className="space-y-space-md" aria-disabled={closed}>
          {showOutcomes ? (
            <OutcomePad
              onSelect={sendOutcome}
              onCancel={() => setShowOutcomes(false)}
              disabled={sending || closed}
            />
          ) : (
            <PitchPad
              onPitch={(call) => {
                if (call === "H" || call === "I") return;
                void send({ kind: "pitch", call });
              }}
              onInPlay={() => setShowOutcomes(true)}
              disabled={sending || closed}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-space-sm">
          <Link href="/score" className={secondaryButton}>
            Volver
          </Link>
          <a href={`${VIEWER_URL}/score/${game.id}`} className={secondaryButton}>
            Ver en el visor
          </a>
        </div>
      </div>
    </ScorerShell>
  );
}
