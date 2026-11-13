import { Bases } from "./bases";
import type { GameState } from "@/lib/scorer/fold";

interface TeamRowProps {
  name: string;
  score: number;
  batting: boolean;
  side: string;
}

function TeamRow({ name, score, batting, side }: TeamRowProps) {
  return (
    <div
      className="flex items-baseline justify-between gap-space-md"
      aria-label={`${side} ${name} ${score}`}
    >
      <div className="flex min-w-0 items-baseline gap-space-sm">
        <span className="font-label-caps text-label-caps uppercase text-band-muted">
          {side}
        </span>
        <span className="truncate font-display text-title-md text-band-ink">{name}</span>
        {batting ? (
          <span className="shrink-0 border border-gold px-space-xs font-label-caps text-label-caps uppercase text-gold">
            Al bate
          </span>
        ) : null}
      </div>
      <span className="font-tabular-stats text-headline-md score-num text-band-ink">{score}</span>
    </div>
  );
}

function CountMarks({ filled, total }: { filled: number; total: number }) {
  return (
    <span className="flex gap-space-xs" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-3 w-3 border ${
            index < filled ? "border-band-ink bg-band-ink" : "border-band-muted bg-transparent"
          }`}
        />
      ))}
    </span>
  );
}

interface ScoreboardProps {
  state: GameState;
  awayTeam: string;
  homeTeam: string;
  batter: string | null;
  pitcher: string | null;
  pitcherPitches?: number;
  pitchLimit?: number | null;
}

/** The navy band above the pads: score, inning, outs, count and bases. */
export function Scoreboard({
  state,
  awayTeam,
  homeTeam,
  batter,
  pitcher,
  pitcherPitches,
  pitchLimit = null,
}: ScoreboardProps) {
  const half = state.half === "top" ? "Alta" : "Baja";

  return (
    <section className="bg-band text-band-ink" aria-label="Marcador">
      <div className="space-y-space-xs border-b border-band-muted/40 px-space-md py-space-sm">
        <TeamRow
          name={awayTeam}
          score={state.score.away}
          batting={state.battingTeam === "away"}
          side="Visitante"
        />
        <TeamRow
          name={homeTeam}
          score={state.score.home}
          batting={state.battingTeam === "home"}
          side="Local"
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-band-muted/40 border-b border-band-muted/40">
        <div className="px-space-md py-space-sm">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">Entrada</p>
          <p className="mt-space-xs font-tabular-stats text-tabular-stats text-band-ink">
            {state.inning} · {half}
          </p>
        </div>
        <div className="px-space-md py-space-sm">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">Outs</p>
          <span
            className="mt-space-xs flex gap-space-xs"
            aria-label={`${state.outs} outs`}
          >
            {Array.from({ length: 3 }, (_, index) => (
              <span
                key={index}
                className={`h-4 w-4 border ${
                  index < state.outs
                    ? "border-gold bg-gold"
                    : "border-band-muted bg-transparent"
                }`}
              />
            ))}
          </span>
        </div>
        <div className="px-space-md py-space-sm">
          <p className="font-label-caps text-label-caps uppercase text-band-muted">Cuenta</p>
          <div
            className="mt-space-xs flex flex-wrap items-center gap-space-sm"
            aria-label={`Cuenta ${state.count.balls} bolas, ${state.count.strikes} strikes`}
          >
            <span className="flex items-center gap-space-xs">
              <CountMarks filled={state.count.balls} total={3} />
              <span className="font-label-caps text-label-caps text-band-muted">B</span>
            </span>
            <span className="flex items-center gap-space-xs">
              <CountMarks filled={state.count.strikes} total={2} />
              <span className="font-label-caps text-label-caps text-band-muted">S</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-space-md px-space-md py-space-sm">
        <Bases first={state.bases.first} second={state.bases.second} third={state.bases.third} />
        {batter !== null || pitcher !== null ? (
          <div className="grid gap-space-sm text-right">
            {batter !== null ? (
              <div>
                <p className="font-label-caps text-label-caps uppercase text-band-muted">
                  Al bate
                </p>
                <p className="font-body text-title-md text-band-ink">{batter}</p>
              </div>
            ) : null}
            {pitcher !== null ? (
              <div>
                <p className="font-label-caps text-label-caps uppercase text-band-muted">
                  Pitcher
                </p>
                <p className="font-body text-title-md text-band-ink">{pitcher}</p>
                {pitchLimit !== null ? (
                  <p className="font-tabular-stats text-label-caps text-band-muted">
                    Pitcher: {pitcherPitches ?? 0} / {pitchLimit}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
