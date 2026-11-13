interface BasesProps {
  first: string | null;
  second: string | null;
  third: string | null;
}

function label(occupied: string | null, name: string): string {
  return occupied ? `${name} ocupada` : `${name} libre`;
}

/** The diamond: gold marks an occupied base, navy stays empty. */
export function Bases({ first, second, third }: BasesProps) {
  return (
    <div
      className="relative h-20 w-20 shrink-0"
      role="img"
      aria-label={`Bases: ${label(first, "primera")}, ${label(second, "segunda")}, ${label(third, "tercera")}`}
    >
      <span
        className={`absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rotate-45 border ${
          second ? "border-gold bg-gold" : "border-band-muted bg-transparent"
        }`}
      />
      <span
        className={`absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 border ${
          third ? "border-gold bg-gold" : "border-band-muted bg-transparent"
        }`}
      />
      <span
        className={`absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 rotate-45 border ${
          first ? "border-gold bg-gold" : "border-band-muted bg-transparent"
        }`}
      />
      <span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 border border-band-muted" />
    </div>
  );
}
