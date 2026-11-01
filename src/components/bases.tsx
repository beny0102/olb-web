import type { GameState } from "@/lib/types";

export function BasesDiamond({ bases }: { bases: GameState["bases"] }) {
  const occupied = {
    first: Boolean(bases.first),
    second: Boolean(bases.second),
    third: Boolean(bases.third),
  };

  const baseClass = (on: boolean) =>
    on ? "fill-ember stroke-ember" : "fill-transparent stroke-line";

  return (
    <svg viewBox="0 0 100 100" className="size-24" role="img" aria-label="Bases ocupadas">
      <path
        d="M50 90 L90 50 L50 10 L10 50 Z"
        className="fill-none stroke-line"
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
      <span className="w-12 text-[11px] uppercase tracking-widest text-muted">{label}</span>
      <span className="flex gap-1.5" aria-label={`${filled} de ${total}`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`size-2.5 rounded-full border ${index < filled ? color : "border-line bg-transparent"}`}
          />
        ))}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {dots(3, count.balls, "border-grass bg-grass", "Bolas")}
      {dots(2, count.strikes, "border-ember bg-ember", "Strikes")}
      {dots(2, outs, "border-chalk bg-chalk", "Outs")}
    </div>
  );
}
