import type { GameState } from "@/lib/types";

export function BasesDiamond({ bases }: { bases: GameState["bases"] }) {
  const occupied = {
    first: Boolean(bases.first),
    second: Boolean(bases.second),
    third: Boolean(bases.third),
  };

  const baseClass = (on: boolean) =>
    on ? "fill-gold stroke-gold" : "fill-transparent stroke-band-ink/40";

  return (
    <svg viewBox="0 0 100 100" className="size-24" role="img" aria-label="Bases ocupadas">
      <path
        d="M50 90 L90 50 L50 10 L10 50 Z"
        className="fill-none stroke-band-ink/30"
        strokeWidth="2"
        strokeDasharray="4 5"
      />
      <rect x="39" y="79" width="12" height="12" transform="rotate(45 45 85)" className={baseClass(false)} strokeWidth="2" />
      <rect x="77" y="41" width="12" height="12" transform="rotate(45 83 47)" className={baseClass(occupied.first)} strokeWidth="2" />
      <rect x="39" y="3" width="12" height="12" transform="rotate(45 45 9)" className={baseClass(occupied.second)} strokeWidth="2" />
      <rect x="7" y="41" width="12" height="12" transform="rotate(45 13 47)" className={baseClass(occupied.third)} strokeWidth="2" />
      <title>
        {[
          occupied.first ? "primera" : null,
          occupied.second ? "segunda" : null,
          occupied.third ? "tercera" : null,
        ]
          .filter(Boolean)
          .join(", ") || "bases vacías"}
      </title>
    </svg>
  );
}

export function CountIndicator({ count, outs }: { count: GameState["count"]; outs: number }) {
  const dots = (total: number, filled: number, color: string, label: string) => (
    <div className="flex items-center gap-2">
      <span className="w-12 font-label-caps text-label-caps uppercase text-band-muted">{label}</span>
      <span className="flex gap-1.5" aria-label={`${filled} de ${total}`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`size-2.5 border ${index < filled ? color : "border-band-ink/30 bg-transparent"}`}
          />
        ))}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {dots(3, count.balls, "border-gold bg-gold", "Bolas")}
      {dots(2, count.strikes, "border-accent bg-accent", "Strikes")}
      {dots(2, outs, "border-band-ink bg-band-ink", "Outs")}
    </div>
  );
}
