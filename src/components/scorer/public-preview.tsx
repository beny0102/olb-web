"use client";

import { useEffect, useMemo, useState } from "react";
import type { Event } from "@olb/contract/types";
import { Bases } from "./bases";
import { getBoxScore, type GameBoxScore } from "@/lib/scorer/api";
import { VIEWER_URL } from "@/lib/scorer/config";
import type { GameState } from "@/lib/scorer/fold";
import {
  deriveLinescore,
  describeLastPlay,
  previewStatus,
  teamAbbr,
} from "@/lib/scorer/preview";

type Tab = "live" | "breakdown";
type BoxState = "idle" | "loading" | "ready" | "error";

const STATUS_COPY = {
  scheduled: "Programado",
  live: "En vivo",
  final: "Final",
} as const;

const STATUS_TONE = {
  scheduled: "border border-line-strong text-ink-muted",
  live: "bg-accent text-band-ink",
  final: "bg-band text-band-ink",
} as const;

interface PublicPreviewProps {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  state: GameState;
  events: readonly Event[];
  /** Player id to name, used by the last-play label. */
  names?: Readonly<Record<string, string>>;
  batter: string | null;
  pitcher: string | null;
  pending: number;
  /** The mobile disclosure already repeats the title in its summary. */
  compactHeader?: boolean;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

function CountDots({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="flex gap-space-xs" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 border ${
            index < filled ? "border-band-ink bg-band-ink" : "border-band-muted"
          }`}
        />
      ))}
    </span>
  );
}

function TeamRow({
  name,
  side,
  score,
  batting,
}: {
  name: string;
  side: string;
  score: number;
  batting: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-space-sm"
      aria-label={`${side} ${name} ${score}`}
    >
      <div className="flex min-w-0 items-center gap-space-sm">
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 ${batting ? "bg-gold" : "bg-band-muted/30"}`}
        />
        <span className="shrink-0 font-label-caps text-label-caps uppercase text-band-muted">
          {teamAbbr(name)}
        </span>
        <span className="truncate font-body text-body-sm text-band-ink">{name}</span>
      </div>
      <span className="font-tabular-stats text-headline-sm score-num text-band-ink">
        {score}
      </span>
    </div>
  );
}

function LiveTab({
  state,
  events,
  names,
  awayTeam,
  homeTeam,
  batter,
  pitcher,
}: Omit<PublicPreviewProps, "gameId" | "pending">) {
  const half = state.half === "top" ? "Alta" : "Baja";

  return (
    <div>
      <div className="space-y-space-xs border-b border-band-muted/40 bg-band px-space-sm py-space-sm text-band-ink">
        <TeamRow
          name={awayTeam}
          side="Visitante"
          score={state.score.away}
          batting={state.battingTeam === "away"}
        />
        <TeamRow
          name={homeTeam}
          side="Local"
          score={state.score.home}
          batting={state.battingTeam === "home"}
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-band-muted/40 border-b border-band-muted/40 bg-band text-band-ink">
        <div className="px-space-sm py-space-sm">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">Entrada</p>
          <p className="mt-space-xs font-tabular-stats text-tabular-stats">
            {state.inning} · {half}
          </p>
        </div>
        <div className="px-space-sm py-space-sm">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">Outs</p>
          <span
            className="mt-space-xs flex gap-space-xs"
            aria-label={`${state.outs} outs`}
          >
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={index}
                className={`h-3.5 w-3.5 border ${
                  index < state.outs ? "border-gold bg-gold" : "border-band-muted"
                }`}
              />
            ))}
          </span>
        </div>
        <div className="px-space-sm py-space-sm">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">Cuenta</p>
          <div
            className="mt-space-xs flex flex-wrap items-center gap-space-sm"
            aria-label={`Cuenta ${state.count.balls} bolas, ${state.count.strikes} strikes`}
          >
            <span className="flex items-center gap-space-xs">
              <CountDots filled={state.count.balls} total={3} />
              <span className="font-label-caps text-label-caps text-band-muted">B</span>
            </span>
            <span className="flex items-center gap-space-xs">
              <CountDots filled={state.count.strikes} total={2} />
              <span className="font-label-caps text-label-caps text-band-muted">S</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-space-md bg-band px-space-sm py-space-sm text-band-ink">
        <Bases first={state.bases.first} second={state.bases.second} third={state.bases.third} />
        <div className="grid min-w-0 gap-space-sm text-right">
          <div>
            <p className="font-label-caps text-label-caps uppercase text-band-muted">Al bate</p>
            <p className="truncate font-body text-body-md text-band-ink">
              {batter ?? "—"}
            </p>
          </div>
          <div>
            <p className="font-label-caps text-label-caps uppercase text-band-muted">Pitcher</p>
            <p className="truncate font-body text-body-md text-band-ink">
              {pitcher ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-l-4 border-band bg-surface-low px-space-sm py-space-sm">
        <p className="font-label-caps text-label-caps uppercase text-ink-muted">Última jugada</p>
        <p className="mt-space-xs font-body text-body-md text-ink">
          {describeLastPlay(events, names)}
        </p>
      </div>
    </div>
  );
}

function BreakdownTab({
  state,
  events,
  awayTeam,
  homeTeam,
  box,
  boxState,
}: {
  state: GameState;
  events: readonly Event[];
  awayTeam: string;
  homeTeam: string;
  box: GameBoxScore | null;
  boxState: BoxState;
}) {
  const line = useMemo(() => deriveLinescore(events), [events]);
  const value = (runs: number | null): string => (runs === null ? "–" : String(runs));
  const stat = (team: "home" | "away", key: "hits" | "errors"): string => {
    const side = box?.[team];
    return side ? String(side[key]) : "–";
  };

  return (
    <div>
      <div className="border-b border-line bg-surface-low px-space-sm py-space-sm">
        <p className="font-label-caps text-label-caps uppercase text-ink-muted">
          Línea de anotación
        </p>
        {!line.hasData ? (
          <p className="mt-space-xs font-body text-body-sm text-ink-muted">
            Sin entradas cerradas todavía.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center font-display text-tabular-stats">
          <caption className="sr-only">
            Línea de anotación por entrada de {awayTeam} y {homeTeam}, con carreras, hits y
            errores
          </caption>
          <thead>
            <tr className="border-b border-line-strong bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
              <th scope="col" className="px-2 py-1 text-left">
                Club
              </th>
              {line.innings.map((inning) => (
                <th key={inning.inning} scope="col" className="min-w-6 px-1 py-1">
                  {inning.inning}
                </th>
              ))}
              <th scope="col" className="border-l border-line bg-raised px-2 py-1 text-ink">
                R
              </th>
              <th scope="col" className="px-2 py-1 text-ink">
                H
              </th>
              <th scope="col" className="px-2 py-1 text-ink">
                E
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <th
                scope="row"
                className="px-2 py-1 text-left font-display text-title-md uppercase text-ink"
              >
                {teamAbbr(awayTeam)}
              </th>
              {line.innings.map((inning) => (
                <td key={inning.inning} className="px-1 py-1 text-ink">
                  {value(inning.away)}
                </td>
              ))}
              <td className="border-l border-line bg-raised px-2 py-1 font-extrabold text-ink">
                {state.score.away}
              </td>
              <td className="px-2 py-1 text-ink">{stat("away", "hits")}</td>
              <td className="px-2 py-1 text-ink">{stat("away", "errors")}</td>
            </tr>
            <tr>
              <th
                scope="row"
                className="px-2 py-1 text-left font-display text-title-md uppercase text-accent"
              >
                {teamAbbr(homeTeam)}
              </th>
              {line.innings.map((inning) => (
                <td key={inning.inning} className="px-1 py-1 text-ink">
                  {value(inning.home)}
                </td>
              ))}
              <td className="border-l border-line bg-raised px-2 py-1 font-extrabold text-accent">
                {state.score.home}
              </td>
              <td className="px-2 py-1 text-ink">{stat("home", "hits")}</td>
              <td className="px-2 py-1 text-ink">{stat("home", "errors")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {boxState === "error" ? (
        <p className="border-t border-line px-space-sm py-space-sm font-body text-body-sm text-ink-muted">
          H/E requieren conexión.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Operator-side mirror of the public game page. It reads the same local
 * projection the pads use and never appends, undoes or syncs anything.
 */
export function PublicPreview({
  gameId,
  awayTeam,
  homeTeam,
  state,
  events,
  names,
  batter,
  pitcher,
  pending,
  compactHeader = false,
}: PublicPreviewProps) {
  const [tab, setTab] = useState<Tab>("live");
  const [box, setBox] = useState<GameBoxScore | null>(null);
  const [boxState, setBoxState] = useState<BoxState>("idle");
  const online = useOnline();
  const status = previewStatus(state);
  const note =
    pending > 0 ? "Vista previa local" : online ? "Igual que el visor" : "Sin conexión";

  useEffect(() => {
    if (tab !== "breakdown") return;
    if (!online) {
      setBox(null);
      setBoxState("error");
      return;
    }

    let cancelled = false;
    setBoxState("loading");

    getBoxScore(gameId)
      .then((next) => {
        if (cancelled) return;
        setBox(next);
        setBoxState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setBox(null);
        setBoxState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [gameId, online, pending, tab, events.length]);

  const tabClass = (value: Tab): string =>
    `min-h-10 px-space-sm font-label-caps text-label-caps uppercase ${
      tab === value ? "bg-band text-band-ink" : "bg-surface-low text-ink-muted hover:text-ink"
    }`;

  return (
    <section
      className="border border-line-strong bg-raised"
      aria-label="Vista pública del juego"
    >
      <header className="space-y-space-xs border-b border-line px-space-sm py-space-sm">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          {compactHeader ? null : (
            <p className="font-label-caps text-label-caps uppercase text-ink">
              Vista pública
            </p>
          )}
          <span
            className={`ml-auto inline-flex items-center px-space-xs py-0.5 font-label-caps text-label-caps uppercase ${STATUS_TONE[status]}`}
          >
            {STATUS_COPY[status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <p
            aria-live="polite"
            className={`font-body text-body-sm ${
              pending > 0 || !online ? "text-accent" : "text-ink-muted"
            }`}
          >
            {note}
          </p>
          <a
            href={`${VIEWER_URL}/games/${gameId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center border border-line-strong px-space-sm font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
          >
            Abrir visor ↗
          </a>
        </div>
      </header>

      <div role="tablist" aria-label="Vista pública" className="grid grid-cols-2 border-b border-line">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "live"}
          className={tabClass("live")}
          onClick={() => setTab("live")}
        >
          En vivo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "breakdown"}
          className={tabClass("breakdown")}
          onClick={() => setTab("breakdown")}
        >
          Desglose
        </button>
      </div>

      {tab === "live" ? (
        <LiveTab
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          state={state}
          events={events}
          names={names}
          batter={batter}
          pitcher={pitcher}
        />
      ) : (
        <BreakdownTab
          state={state}
          events={events}
          awayTeam={awayTeam}
          homeTeam={homeTeam}
          box={box}
          boxState={boxState}
        />
      )}
    </section>
  );
}

/**
 * Below `xl` the pads stay primary: the preview hides behind a native
 * disclosure, closed until the operator asks for it.
 */
export function MobilePublicPreview(props: PublicPreviewProps) {
  return (
    <details className="group xl:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between border border-line-strong bg-raised px-space-sm font-label-caps text-label-caps uppercase text-ink [&::-webkit-details-marker]:hidden">
        <span>Vista pública</span>
        <span className="font-body text-body-sm normal-case text-ink-muted group-open:hidden">
          Mostrar
        </span>
        <span className="hidden font-body text-body-sm normal-case text-ink-muted group-open:inline">
          Ocultar
        </span>
      </summary>
      <div className="mt-space-sm">
        <PublicPreview {...props} compactHeader />
      </div>
    </details>
  );
}
