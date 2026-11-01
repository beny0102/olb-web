import Link from "next/link";
import { formatTime, statusLabel } from "@/lib/format";
import type { GameRecord, GameState } from "@/lib/types";

const STATUS_TONE: Record<GameState["status"], string> = {
  live: "border-grass/50 bg-grass/10 text-grass",
  final: "border-line bg-panel text-muted",
  scheduled: "border-line bg-panel text-muted",
  suspended: "border-ember/40 bg-ember/10 text-ember",
  forfeit: "border-ember/40 bg-ember/10 text-ember",
};

export function GameCard({
  game,
  state,
}: {
  game: GameRecord;
  state: GameState | null;
}) {
  const status = state?.status ?? "scheduled";

  return (
    <Link
      href={`/games/${game.id}`}
      className="panel group flex flex-col gap-4 p-5 transition-colors hover:border-grass/60"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_TONE[status]}`}
        >
          {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-grass" /> : null}
          {statusLabel(status)}
        </span>
        <span className="font-mono text-[11px] text-muted">{formatTime(game.createdAt)}</span>
      </div>

      <div>
        <p className="text-lg font-semibold tracking-tight">
          {game.awayTeam} <span className="text-muted">vs</span> {game.homeTeam}
        </p>
        {state ? (
          <p className="mt-1 font-mono text-xs text-muted">
            {state.score.away}–{state.score.home} · {state.inning}ª{" "}
            {state.half === "top" ? "alta" : "baja"}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">Sin estado disponible</p>
        )}
      </div>

      <span className="mt-auto font-mono text-[11px] text-muted transition-colors group-hover:text-grass">
        Abrir visor →
      </span>
    </Link>
  );
}
