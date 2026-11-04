import { BasesDiamond, CountIndicator } from "@/components/bases";
import { scoreboardLine, statusLabel } from "@/lib/format";
import type { GameRecord, GameState } from "@/lib/types";

function TeamRow({
  name,
  side,
  runs,
  batting,
}: {
  name: string;
  side: string;
  runs: number;
  batting: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`size-2 shrink-0 ${batting ? "bg-accent" : "bg-band-ink/20"}`}
          aria-hidden="true"
        />
        <span className="truncate font-display text-title-lg uppercase text-band-ink sm:text-headline-sm">
          {name}
        </span>
        <span className="shrink-0 border border-band-ink/30 px-1.5 py-0.5 font-label-caps text-label-caps uppercase text-band-ink/70">
          {side}
        </span>
      </div>
      <span className="score-num font-display text-tabular-stats text-band-ink sm:text-headline-sm">
        {runs}
      </span>
    </div>
  );
}

function statusTone(status: GameState["status"], demo: boolean, live: boolean): string {
  if (demo) return "bg-gold text-band";
  if (live) return "bg-accent text-band-ink";
  if (status === "suspended") return "bg-gold text-band";
  return "border border-band-ink/40 text-band-ink";
}

export function Scoreboard({
  game,
  state,
  demo = false,
}: {
  game: GameRecord;
  state: GameState;
  demo?: boolean;
}) {
  const showLive = state.status === "live";
  const live = showLive && !demo;
  const accent = demo ? "bg-gold" : live ? "bg-accent" : "bg-band-muted";

  return (
    <section
      className="relative overflow-hidden border border-band bg-band p-5 text-band-ink sm:p-6"
      aria-label="Marcador"
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${accent}`} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-label-caps text-label-caps uppercase text-band-muted">
            {demo ? "Demostración · datos sintéticos" : "Juego"}
          </p>
          <h1 className="mt-1 font-display text-headline-sm uppercase text-band-ink sm:text-headline-md">
            {game.awayTeam} <span className="text-band-muted">vs</span> {game.homeTeam}
          </h1>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-1 font-label-caps text-label-caps uppercase ${statusTone(
            state.status,
            demo,
            live,
          )}`}
        >
          {live ? <span className="size-1.5 animate-pulse bg-band-ink" aria-hidden="true" /> : null}
          {demo ? "Demo" : statusLabel(state.status)}
        </span>
      </div>

      <div
        className="mt-5 divide-y divide-band-ink/15 border-y border-band-ink/15"
        aria-live="polite"
      >
        <TeamRow
          name={game.awayTeam}
          side="Visitante"
          runs={state.score.away}
          batting={state.battingTeam === "away"}
        />
        <TeamRow
          name={game.homeTeam}
          side="Local"
          runs={state.score.home}
          batting={state.battingTeam === "home"}
        />
      </div>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">
            {scoreboardLine(state)}
          </p>
          {showLive ? <CountIndicator count={state.count} outs={state.outs} /> : null}
        </div>
        {showLive ? (
          <div className="flex flex-col items-center gap-1">
            <BasesDiamond bases={state.bases} />
            <span className="font-label-caps text-label-caps uppercase text-band-muted">
              Bases
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
