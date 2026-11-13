"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listProposals,
  resolveProposal,
  type Proposal,
  type ProposalPayload,
} from "@/lib/scorer/api";
import { proposalLabel } from "@/lib/scorer/proposals";

interface ProposalInboxProps {
  gameId: string;
  /** The writer's append; resolves true only when the event reached the log. */
  onAccept: (payload: ProposalPayload) => Promise<boolean>;
  disabled?: boolean;
}

const acceptClass =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-md font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-50";

const rejectClass =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-50";

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * The writer's inbox for two-person mode. It only shows what the API returns;
 * when the API never answers, the card disappears instead of adding another
 * error banner, because the sync pill already reports connectivity.
 */
export function ProposalInbox({ gameId, onAccept, disabled = false }: ProposalInboxProps) {
  const [rows, setRows] = useState<Proposal[]>([]);
  const [reachable, setReachable] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const processed = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    try {
      const next = await listProposals(gameId, "open");
      if (!mounted.current) return;
      // A proposal whose play was appended but whose resolve failed stays
      // hidden for this session, so a retry cannot append the play twice.
      setRows(next.filter((row) => !processed.current.has(row.id)));
      setReachable(true);
    } catch {
      if (!mounted.current) return;
      setReachable(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    void refresh();

    const handleOnline = () => void refresh();
    window.addEventListener("online", handleOnline);

    const timer = window.setInterval(() => {
      if (navigator.onLine) void refresh();
    }, 5000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [gameId, refresh]);

  async function decide(
    proposal: Proposal,
    decision: "accepted" | "rejected",
  ): Promise<void> {
    if (processed.current.has(proposal.id) || busyId !== null) return;

    // Claim the proposal before awaiting so a double tap cannot append twice.
    processed.current.add(proposal.id);
    setBusyId(proposal.id);

    let appended = decision === "rejected";

    try {
      if (decision === "accepted") {
        appended = await onAccept(proposal.payload);
        if (!appended) {
          processed.current.delete(proposal.id);
          return;
        }
      }

      await resolveProposal(gameId, proposal.id, decision);
      if (!mounted.current) return;
      setRows((current) => current.filter((row) => row.id !== proposal.id));
    } catch {
      // If the play was already appended, keep the id claimed so a poll cannot
      // offer it again and append a second event; otherwise let the poll retry.
      if (!appended) processed.current.delete(proposal.id);
      if (mounted.current) setReachable(false);
    } finally {
      if (mounted.current) setBusyId(null);
    }
  }

  if (!reachable || rows.length === 0) return null;

  return (
    <section
      aria-label="Propuestas del verificador"
      className="border border-accent bg-accent-soft px-space-md py-space-sm"
    >
      <p className="font-label-caps text-label-caps uppercase text-accent">
        Propuestas del verificador · {rows.length}
      </p>
      <ul className="mt-space-sm divide-y divide-line border-t border-line">
        {rows.map((proposal) => (
          <li
            key={proposal.id}
            className="flex flex-wrap items-center justify-between gap-space-sm py-space-sm"
          >
            <div className="min-w-0">
              <p className="font-display text-headline-sm text-ink">
                {proposalLabel(proposal.payload)}
              </p>
              <p className="font-body text-body-sm text-ink-muted">
                {proposal.author}
                {formatTime(proposal.createdAt)
                  ? ` · ${formatTime(proposal.createdAt)}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-space-sm">
              <button
                type="button"
                className={acceptClass}
                onClick={() => void decide(proposal, "accepted")}
                disabled={disabled || busyId !== null}
              >
                Aceptar
              </button>
              <button
                type="button"
                className={rejectClass}
                onClick={() => void decide(proposal, "rejected")}
                disabled={disabled || busyId !== null}
              >
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
