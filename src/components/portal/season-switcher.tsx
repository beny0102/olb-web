import Link from "next/link";
import type { LeagueSeason } from "@/lib/types";

export function SeasonSwitcher({
  seasons,
  activeId,
}: {
  seasons: readonly LeagueSeason[];
  activeId: string | null;
}) {
  if (seasons.length === 0) return null;

  return (
    <section aria-label="Temporadas" className="border-b border-line bg-surface-low">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 overflow-x-auto px-4 py-2 md:px-8">
        <span className="shrink-0 font-label-caps text-label-caps uppercase text-accent">
          Temporada
        </span>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-line-strong" />
        <div role="list" className="flex items-center gap-1">
          {seasons.map((season) => {
            const active = season.id === activeId;
            return (
              <Link
                key={season.id}
                href={`/?season=${encodeURIComponent(season.id)}`}
                role="listitem"
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "bg-band px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink"
                    : "border border-transparent px-2 py-1 font-label-caps text-label-caps uppercase text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                }
              >
                {season.name}
                {season.status === "active" ? " · activa" : ""}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
