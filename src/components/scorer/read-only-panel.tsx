"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Membership } from "@/lib/scorer/auth";
import { primaryMembership, roleLabel } from "@/lib/scorer/roles";
import { useAuth } from "./auth-provider";

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-lg font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent";

export interface ReadOnlyPanelProps {
  gameId: string;
  memberships: readonly Membership[];
  /** Local plays still waiting in the outbox; none are sent with this role. */
  pendingPlays?: number;
  /** Recovered score, shown as plain text. */
  scoreline?: string | null;
  /** Recovered status or inning, shown as plain text. */
  statusLabel?: string | null;
}

/**
 * The panel a signed-in user without a scoring role gets instead of the setup
 * form or the scoring controls. The API stays the authority; this keeps the
 * user from scoring into an outbox that will only answer 403.
 */
export function ReadOnlyPanel({
  gameId,
  memberships,
  pendingPlays = 0,
  scoreline,
  statusLabel,
}: ReadOnlyPanelProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const membership = primaryMembership(memberships);
  const role = membership ? roleLabel(membership.role) : null;

  async function handleLogout(): Promise<void> {
    setLeaving(true);
    try {
      await logout();
      router.replace("/score");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <section className="border border-line-strong bg-raised px-space-md py-space-md">
      <h2 className="font-display text-headline-sm text-ink">Modo solo lectura</h2>

      {statusLabel ? (
        <p className="mt-space-xs font-label-caps text-label-caps uppercase text-ink-muted">
          {statusLabel}
        </p>
      ) : null}

      {scoreline ? (
        <p className="mt-space-xs font-display text-headline-lg-mobile text-ink">
          {scoreline}
        </p>
      ) : null}

      <p className="mt-space-sm font-body text-body-md text-ink">
        {role ? `Tu rol es ${role}` : "Tu cuenta no tiene un rol de anotación"}
      </p>

      <p className="mt-space-xs font-body text-body-md text-ink-muted">
        Puedes ver el juego y enviar propuestas, pero no anotar ni sincronizar
        jugadas. Entra con un usuario Anotador, Admin de equipo o Admin de liga
        para anotar.
      </p>

      {pendingPlays > 0 ? (
        <p
          role="status"
          className="mt-space-sm border-l-4 border-gold bg-surface-low px-space-sm py-space-sm font-body text-body-sm text-ink"
        >
          {pendingPlays === 1
            ? "Tienes 1 jugada local que no se enviará con este rol."
            : `Tienes ${pendingPlays} jugadas locales que no se enviarán con este rol.`}
        </p>
      ) : null}

      <div className="mt-space-md flex flex-wrap gap-space-sm">
        <Link href={`/score/${gameId}/verify`} className={primaryButton}>
          Ir al modo verificador
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={leaving}
          className={secondaryButton}
        >
          {leaving ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </section>
  );
}
