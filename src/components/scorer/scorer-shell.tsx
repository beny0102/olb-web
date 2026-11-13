import Link from "next/link";
import type { ReactNode } from "react";
import { SessionBadge } from "./session-badge";
import { SyncPill } from "./sync-pill";

interface ScorerShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  /** Scope the outbox pill to one game; setup and scoring pass it. */
  gameId?: string;
  /** Read-only visitors get no sync controls; the outbox stays untouched. */
  hideSync?: boolean;
  /** Scoring needs room for the public-preview rail from `xl` up. */
  wide?: boolean;
  children: ReactNode;
}

/** The shared chalk page: one column, square edges, no ambient shadow. */
export function ScorerShell({
  title,
  subtitle,
  backHref,
  backLabel = "Atrás",
  actions,
  gameId,
  hideSync = false,
  wide = false,
  children,
}: ScorerShellProps) {
  return (
    <div className="portal-shell min-h-dvh bg-surface">
      <main
        className={`mx-auto w-full px-margin py-space-lg ${
          wide ? "max-w-3xl xl:max-w-6xl" : "max-w-3xl"
        }`}
      >
        <header className="border-b border-line-strong pb-space-md">
          {backHref ? (
            <Link
              href={backHref}
              className="mb-space-sm inline-flex min-h-12 items-center font-label-caps text-label-caps uppercase text-ink-muted hover:text-accent"
            >
              ← {backLabel}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-space-md">
            <div>
              <h1 className="font-display text-headline-lg-mobile text-ink md:text-headline-lg">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-space-xs font-body text-body-md text-ink-muted">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-space-sm">
              {actions}
              <SessionBadge />
            </div>
          </div>
        </header>
        {hideSync ? null : (
          <div className="border-b border-line py-space-sm">
            <SyncPill gameId={gameId} />
          </div>
        )}
        <div className="py-space-lg">{children}</div>
      </main>
    </div>
  );
}
