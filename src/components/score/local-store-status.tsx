"use client";

import { useEffect, useState } from "react";

const SCORER_DB = "olb-scorer";
const GAMES_STORE = "games";
const LOCAL_COUNT_KEY = "olb-scorer-game-count";

type LocalState = {
  ready: boolean;
  indexedDb: boolean;
  count: number | null;
  source: "indexedDB" | "localStorage" | null;
};

const INITIAL: LocalState = { ready: false, indexedDb: false, count: null, source: null };

function readLocalStorageCount(): number | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_COUNT_KEY);
    if (raw === null) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

async function readIndexedDbCount(): Promise<number | null> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return null;

  try {
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === SCORER_DB)) return null;

    return await new Promise<number | null>((resolve) => {
      let settled = false;
      const settle = (value: number | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const open = indexedDB.open(SCORER_DB);
      open.onupgradeneeded = () => {
        open.transaction?.abort();
        settle(null);
      };
      open.onerror = () => settle(null);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(GAMES_STORE)) {
          db.close();
          settle(null);
          return;
        }

        const request = db.transaction(GAMES_STORE, "readonly").objectStore(GAMES_STORE).count();
        request.onsuccess = () => {
          settle(request.result);
          db.close();
        };
        request.onerror = () => {
          settle(null);
          db.close();
        };
      };
    });
  } catch {
    return null;
  }
}

/**
 * Read-only probe of the scorer's local data. No login and no writes.
 * TODO F8.2: replace with the shared auth session + IndexedDB repository.
 */
export function ScoreLocalStoreStatus() {
  const [state, setState] = useState<LocalState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    async function inspect() {
      const indexedDb = typeof indexedDB !== "undefined";
      const indexedDbCount = indexedDb ? await readIndexedDbCount() : null;
      const localStorageCount = readLocalStorageCount();
      if (cancelled) return;

      setState({
        ready: true,
        indexedDb,
        count: indexedDbCount ?? localStorageCount,
        source: indexedDbCount !== null ? "indexedDB" : localStorageCount !== null ? "localStorage" : null,
      });
    }

    void inspect();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-2">
      <p data-local-games={state.ready ? (state.count ?? "none") : "pending"} className="font-body text-body-md text-ink">
        {!state.ready
          ? "Revisando partidos locales…"
          : state.count === null
            ? "Sin partidos locales en este dispositivo."
            : `${state.count} ${state.count === 1 ? "partido local" : "partidos locales"} (${state.source}).`}
      </p>
      <p data-indexeddb={state.indexedDb ? "available" : "unavailable"} className="font-body text-body-sm text-ink-muted">
        IndexedDB <span className="font-mono text-ink">olb-scorer</span>:{" "}
        {state.indexedDb ? "disponible" : "no disponible"}.
      </p>
    </div>
  );
}
