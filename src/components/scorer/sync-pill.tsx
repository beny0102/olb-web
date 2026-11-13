"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { localStore } from "@/lib/scorer/store";
import { countPending, syncGame } from "@/lib/scorer/sync";

export interface SyncPillProps {
  /** Restrict the outbox to one game; absent means every local game. */
  gameId?: string;
}

interface Counts {
  pending: number;
  total: number;
}

async function readCounts(gameId?: string): Promise<Counts> {
  const store = localStore();

  if (gameId) {
    return {
      pending: await countPending(store, gameId),
      total: (await store.listEvents(gameId)).length,
    };
  }

  let pending = 0;
  let total = 0;
  for (const game of await store.listGames()) {
    const events = await store.listEvents(game.id);
    pending += events.filter((entry) => entry.status === "pending").length;
    total += events.length;
  }
  return { pending, total };
}

/**
 * The outbox status. `navigator.onLine` is only a hint: a failed request also
 * shows "Sin conexión", and a rejected event stops the run with its message.
 */
export function SyncPill({ gameId }: SyncPillProps) {
  const [counts, setCounts] = useState<Counts>({ pending: 0, total: 0 });
  const [online, setOnline] = useState(true);
  const [failureOffline, setFailureOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await readCounts(gameId);
      if (mounted.current) setCounts(next);
    } catch {
      // A closed database shows up as a failed sync, not as a pill crash.
    }
  }, [gameId]);

  const runSync = useCallback(async () => {
    if (inFlight.current) return;

    const store = localStore();
    let targets: string[] = [];

    try {
      targets = gameId
        ? [gameId]
        : (await store.listGames()).map((game) => game.id);
      const pending = gameId
        ? await countPending(store, gameId)
        : (await readCounts()).pending;

      if (pending === 0) {
        if (mounted.current) {
          setError(null);
          setFailureOffline(false);
        }
        await refresh();
        return;
      }
    } catch {
      await refresh();
      return;
    }

    inFlight.current = true;
    if (mounted.current) setSyncing(true);

    let firstError: string | null = null;
    let offline = false;

    try {
      for (const id of targets) {
        const result = await syncGame(store, id);
        if (result.error) {
          firstError = result.error;
          offline = result.offline;
          break;
        }
      }
      if (mounted.current) {
        setError(firstError);
        setFailureOffline(offline);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSyncing(false);
      await refresh();
      // The score screen keeps its own snapshot; tell it the outbox moved so
      // the public preview and the box score stop showing stale local data.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("olb-sync-complete"));
      }
    }
  }, [gameId, refresh]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();

    const handleOnline = () => {
      setOnline(true);
      void runSync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void runSync();

    const timer = window.setInterval(() => {
      if (navigator.onLine) void runSync();
    }, 10_000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runSync]);

  const offline = !online || failureOffline;
  const label = syncing
    ? "Sincronizando…"
    : offline
      ? `Sin conexión · ${counts.pending} pendientes`
      : counts.pending > 0
        ? `${counts.pending} pendientes`
        : `Al día · ${counts.total} eventos`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-space-sm">
      <div className="min-w-0">
        <p
          aria-live="polite"
          className="flex items-center gap-space-sm font-label-caps text-label-caps uppercase text-ink-muted"
        >
          <span
            aria-hidden
            className={`inline-block h-2 w-2 shrink-0 ${
              offline ? "bg-accent" : "bg-ink"
            }`}
          />
          <span className={offline ? "text-accent" : undefined}>{label}</span>
        </p>
        {error ? (
          <p role="status" className="mt-space-xs font-body text-body-sm text-ink-muted">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void runSync()}
        disabled={syncing}
        className="inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-60"
      >
        Sincronizar
      </button>
    </div>
  );
}
