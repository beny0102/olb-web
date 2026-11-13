"use client";

import { roleLabel } from "@/lib/scorer/roles";
import { useAuth } from "./auth-provider";

/** Compact signed-in identity with a one-tap logout. */
export function SessionBadge() {
  const { user, memberships, loading, logout } = useAuth();

  if (loading || !user) return null;

  const membership =
    memberships.find((entry) => entry.role === "scorer") ?? memberships[0];
  const role = membership ? roleLabel(membership.role) : roleLabel(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-space-sm">
      <span className="inline-flex min-h-12 items-center border border-line px-space-sm font-body text-body-sm text-ink">
        {user.name}
        <span className="ml-space-xs text-ink-muted">· {role}</span>
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
      >
        Salir
      </button>
    </div>
  );
}
