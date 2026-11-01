import { BasesDiamond, CountIndicator } from "@/components/bases";
import { inningLabel, outsLabel, statusLabel } from "@/lib/format";
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
          className={`size-2 shrink-0 rounded-full ${batting ? "bg-ember" : "bg-line"}`}
          aria-hidden="true"
        />
        <span className="truncate text-base font-medium sm:text-lg">{name}</span>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {side}
        </span>
      </div>
      <span className="score-num font-mono text-3xl font-semibold tabular-nums sm:text-4xl">{runs}</span>
    </div>
  );
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
  const live = state.status === "live" && !demo;

  return (
    <section className="panel p-5 sm:p-6" aria-label="Marcador">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
            {demo ? "Demostración · datos sintéticos" : "Juego"}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {game.awayTeam} <span className="text-muted">vs</span> {game.homeTeam}
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            live ? "border-grass/50 bg-grass/10 text-grass" : "border-line bg-panel text-muted"
          }`}
        >
          <span className={`size-1.5 rounded-full ${live ? "animate-pulse bg-grass" : "bg-muted"}`} />
          {demo ? "Demo" : statusLabel(state.status)}
        </span>
      </div>

      <div className="mt-5 divide-y divide-line border-y border-line" aria-live="polite">
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
          <p className="font-mono text-xs tracking-wide text-muted">
            {inningLabel(state)} · {outsLabel(state.outs)}
          </p>
          <CountIndicator count={state.count} outs={state.outs} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <BasesDiamond bases={state.bases} />
          <span className="text-[10px] uppercase tracking-widest text-muted">Bases</span>
        </div>
      </div>
    </section>
  );
}
