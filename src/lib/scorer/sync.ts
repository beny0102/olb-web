import { ApiError, appendEvent } from "./api";
import type { GameStore } from "./db";

/** The outcome of one drain of the local outbox for a game. */
export interface SyncResult {
  /** Events the server accepted during this run. */
  synced: number;
  /** Events still pending when the run stopped. */
  pending: number;
  /** A Spanish message for the pill, or null when the outbox drained. */
  error: string | null;
  /** Whether retrying later can succeed (network, timeout, 5xx). */
  retryable: boolean;
  /** The network never answered, whatever `navigator.onLine` says. */
  offline: boolean;
}

function failure(
  caught: unknown,
  synced: number,
  pending: number,
): SyncResult {
  if (caught instanceof ApiError) {
    return {
      synced,
      pending,
      error: caught.message,
      retryable: caught.status === 0 || caught.status >= 500,
      offline: caught.status === 0,
    };
  }

  return {
    synced,
    pending,
    error: "No pudimos sincronizar las jugadas.",
    retryable: true,
    offline: false,
  };
}

/**
 * Uploads the pending slice of one game in local order. The local log is the
 * outbox: an event is only marked synced after the server acknowledges it, and
 * a rejected event stops the run so a later event never jumps ahead of it.
 *
 * The event `id` makes the POST idempotent, so a retry after a lost response
 * returns the stored event instead of appending a duplicate.
 */
export async function syncGame(
  store: GameStore,
  gameId: string,
): Promise<SyncResult> {
  let synced = 0;

  for (const entry of await store.pendingEvents(gameId)) {
    try {
      const serverEvent = await appendEvent(gameId, entry.event);
      await store.markSynced(gameId, entry.localSeq, serverEvent);
      synced += 1;
    } catch (caught) {
      const pending = (await store.pendingEvents(gameId)).length;
      return failure(caught, synced, pending);
    }
  }

  return {
    synced,
    pending: (await store.pendingEvents(gameId)).length,
    error: null,
    retryable: false,
    offline: false,
  };
}

/** How many events of the game still wait for the server. */
export async function countPending(
  store: GameStore,
  gameId: string,
): Promise<number> {
  return (await store.pendingEvents(gameId)).length;
}
