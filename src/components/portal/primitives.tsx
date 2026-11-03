import type { GameStatus, GameState } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/league";

const STATUS_TONE: Record<GameStatus, string> = {
  scheduled: "border border-line-strong bg-raised text-ink-muted",
  live: "bg-accent text-band-ink",
  final: "bg-band text-band-ink",
  suspended: "bg-gold text-band",
  forfeit: "bg-ink text-band-ink",
};

export function StatusBadge({
  status,
  suffix,
}: {
  status: GameStatus;
  suffix?: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-label-caps text-label-caps uppercase ${STATUS_TONE[status]}`}
    >
      {status === "live" ? <span className="size-1.5 bg-band-ink" /> : null}
      {STATUS_LABEL[status]}
      {suffix ? <span className="opacity-80">· {suffix}</span> : null}
    </span>
  );
}

export function InningMark({
  state,
  closedInning,
}: {
  state: GameState | null;
  closedInning?: number | null;
}) {
  if (!state) return <span>Sin estado</span>;
  if (state.status === "final") {
    return <span>Final / {closedInning ?? state.inning}</span>;
  }
  if (state.status === "scheduled") {
    return <span>Programado</span>;
  }
  if (state.status === "suspended") {
    return (
      <span>
        Suspendido · {state.inning}.ª {state.half === "top" ? "alta" : "baja"}
      </span>
    );
  }
  return (
    <span>
      {state.inning}.ª {state.half === "top" ? "alta" : "baja"}
    </span>
  );
}

export function SectionHeader({
  kicker,
  title,
  action,
  id,
}: {
  kicker: string;
  title: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <span className="block font-label-caps text-label-caps uppercase text-accent">
          {kicker}
        </span>
        <h2
          id={id}
          className="mt-1 font-display text-headline-md uppercase text-ink sm:text-headline-lg"
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Arrow() {
  return <span aria-hidden="true">→</span>;
}
