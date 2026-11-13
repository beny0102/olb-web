import Link from "next/link";
import type { ReactNode } from "react";

interface GameCardProps {
  awayTeam: string;
  homeTeam: string;
  status: string;
  meta?: string | null;
  href: string;
  action?: ReactNode;
}

/** One game row, shared by the local list and the league list. */
export function GameCard({
  awayTeam,
  homeTeam,
  status,
  meta,
  href,
  action,
}: GameCardProps) {
  return (
    <article className="border border-line-strong bg-raised">
      <Link href={href} className="block min-h-12 px-space-md py-space-md hover:bg-surface-low">
        <div className="flex items-start justify-between gap-space-md">
          <p className="font-label-caps text-label-caps uppercase text-ink-muted">{status}</p>
          {meta ? (
            <p className="score-num text-right font-body text-body-sm text-ink-muted">{meta}</p>
          ) : null}
        </div>
        <p className="mt-space-xs font-display text-headline-sm text-ink">
          {awayTeam} <span className="text-ink-muted">@</span> {homeTeam}
        </p>
      </Link>
      {action ? (
        <div className="border-t border-line px-space-md py-space-sm">{action}</div>
      ) : null}
    </article>
  );
}
