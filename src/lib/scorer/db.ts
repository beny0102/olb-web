import type { Event } from "@olb/contract/types";
import { foldEvents, type GameState } from "./fold";
import { normalizeRules } from "./rules";
import type { LocalGame, StoredEvent } from "./types";

/** A game read from an older build has no `rules`; fill it before the UI sees it. */
function withRules(game: LocalGame): LocalGame {
  return { ...game, rules: normalizeRules(game.rules) };
}

/** Local, append-only log of one device. Sync reads the pending slice. */
export interface GameStore {
  putGame(game: LocalGame): Promise<void>;
  getGame(id: string): Promise<LocalGame | null>;
  listGames(): Promise<LocalGame[]>;
  appendEvent(gameId: string, event: Event): Promise<StoredEvent>;
  listEvents(gameId: string): Promise<StoredEvent[]>;
  pendingEvents(gameId: string): Promise<StoredEvent[]>;
  markSynced(gameId: string, localSeq: number, serverEvent: Event): Promise<void>;
  /**
   * Appends server events this device has not seen as already synced, after the
   * current local maximum. Events already present (by `id`) are skipped, so a
   * second recovery imports nothing. Returns the number of events imported.
   */
  importSyncedEvents(gameId: string, events: Event[]): Promise<number>;
}

/** Test double with the same ordering rules as the IndexedDB store. */
export class MemoryGameStore implements GameStore {
  private readonly games = new Map<string, LocalGame>();
  private readonly events = new Map<string, StoredEvent[]>();

  async putGame(game: LocalGame): Promise<void> {
    this.games.set(game.id, structuredClone(withRules(game)));
  }

  async getGame(id: string): Promise<LocalGame | null> {
    const game = this.games.get(id);
    return game ? structuredClone(withRules(game)) : null;
  }

  async listGames(): Promise<LocalGame[]> {
    return Array.from(this.games.values(), (game) => structuredClone(withRules(game)));
  }

  async appendEvent(gameId: string, event: Event): Promise<StoredEvent> {
    const list = this.events.get(gameId) ?? [];
    const localSeq =
      list.length === 0 ? 0 : Math.max(...list.map((entry) => entry.localSeq)) + 1;
    const stored: StoredEvent = { gameId, localSeq, status: "pending", event };
    list.push(stored);
    this.events.set(gameId, list);
    return structuredClone(stored);
  }

  async listEvents(gameId: string): Promise<StoredEvent[]> {
    return (this.events.get(gameId) ?? [])
      .slice()
      .sort((a, b) => a.localSeq - b.localSeq)
      .map((entry) => structuredClone(entry));
  }

  async pendingEvents(gameId: string): Promise<StoredEvent[]> {
    return (await this.listEvents(gameId)).filter((entry) => entry.status === "pending");
  }

  async markSynced(gameId: string, localSeq: number, serverEvent: Event): Promise<void> {
    const list = this.events.get(gameId) ?? [];
    const index = list.findIndex((entry) => entry.localSeq === localSeq);
    if (index === -1) {
      throw new Error(`No existe el evento local ${gameId}#${localSeq}.`);
    }
    const current = list[index]!;
    list[index] = {
      ...current,
      status: "synced",
      event: serverEvent,
    };
    this.events.set(gameId, list);
  }

  async importSyncedEvents(gameId: string, events: Event[]): Promise<number> {
    const list = this.events.get(gameId) ?? [];
    const known = new Set(list.map((entry) => entry.event.id));
    let localSeq = list.reduce((max, entry) => Math.max(max, entry.localSeq), -1);
    let imported = 0;

    for (const event of events) {
      if (known.has(event.id)) continue;
      known.add(event.id);
      localSeq += 1;
      list.push({
        gameId,
        localSeq,
        status: "synced",
        event: structuredClone(event),
      });
      imported += 1;
    }

    if (imported > 0) this.events.set(gameId, list);
    return imported;
  }
}

const DB_NAME = "olb-scorer";
const DB_VERSION = 1;
const GAMES_STORE = "games";
const EVENTS_STORE = "events";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transacción de IndexedDB abortada."));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(GAMES_STORE)) {
        db.createObjectStore(GAMES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const events = db.createObjectStore(EVENTS_STORE, {
          keyPath: ["gameId", "localSeq"],
        });
        events.createIndex("byGame", "gameId");
        events.createIndex("byStatus", ["gameId", "status"]);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Browser store. The schema keeps `status` as a string ("pending" | "synced"):
 * IndexedDB cannot index a boolean key, and string keys are easier to inspect.
 */
export class IndexedDbGameStore implements GameStore {
  private db: Promise<IDBDatabase> | null = null;

  private database(): Promise<IDBDatabase> {
    this.db ??= openDatabase();
    return this.db;
  }

  async putGame(game: LocalGame): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(GAMES_STORE, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(GAMES_STORE).put(withRules(game));
    await done;
  }

  async getGame(id: string): Promise<LocalGame | null> {
    const db = await this.database();
    const tx = db.transaction(GAMES_STORE, "readonly");
    const done = transactionDone(tx);
    const game = await request<LocalGame | undefined>(
      tx.objectStore(GAMES_STORE).get(id),
    );
    await done;
    return game ? withRules(game) : null;
  }

  async listGames(): Promise<LocalGame[]> {
    const db = await this.database();
    const tx = db.transaction(GAMES_STORE, "readonly");
    const done = transactionDone(tx);
    const games = await request<LocalGame[]>(tx.objectStore(GAMES_STORE).getAll());
    await done;
    return games.map(withRules);
  }

  async appendEvent(gameId: string, event: Event): Promise<StoredEvent> {
    const db = await this.database();
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(EVENTS_STORE);

    const keys = await request<IDBValidKey[]>(
      store.index("byGame").getAllKeys(IDBKeyRange.only(gameId)),
    );
    const localSeq =
      keys.reduce<number>((max, key) => {
        const value = Array.isArray(key) ? Number(key[1]) : 0;
        return Number.isFinite(value) ? Math.max(max, value) : max;
      }, -1) + 1;

    const stored: StoredEvent = { gameId, localSeq, status: "pending", event };
    store.put(stored);
    await done;
    return stored;
  }

  async listEvents(gameId: string): Promise<StoredEvent[]> {
    const db = await this.database();
    const tx = db.transaction(EVENTS_STORE, "readonly");
    const done = transactionDone(tx);
    const events = await request<StoredEvent[]>(
      tx.objectStore(EVENTS_STORE).index("byGame").getAll(IDBKeyRange.only(gameId)),
    );
    await done;
    return events.sort((a, b) => a.localSeq - b.localSeq);
  }

  async pendingEvents(gameId: string): Promise<StoredEvent[]> {
    const db = await this.database();
    const tx = db.transaction(EVENTS_STORE, "readonly");
    const done = transactionDone(tx);
    const events = await request<StoredEvent[]>(
      tx
        .objectStore(EVENTS_STORE)
        .index("byStatus")
        .getAll(IDBKeyRange.only([gameId, "pending"])),
    );
    await done;
    return events.sort((a, b) => a.localSeq - b.localSeq);
  }

  async markSynced(gameId: string, localSeq: number, serverEvent: Event): Promise<void> {
    const db = await this.database();
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(EVENTS_STORE);

    const stored = await request<StoredEvent | undefined>(
      store.get([gameId, localSeq]),
    );
    if (!stored) {
      throw new Error(`No existe el evento local ${gameId}#${localSeq}.`);
    }

    const synced: StoredEvent = {
      ...stored,
      status: "synced",
      event: serverEvent,
    };
    store.put(synced);
    await done;
  }

  async importSyncedEvents(gameId: string, events: Event[]): Promise<number> {
    const db = await this.database();
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const done = transactionDone(tx);
    const store = tx.objectStore(EVENTS_STORE);

    const existing = await request<StoredEvent[]>(
      store.index("byGame").getAll(IDBKeyRange.only(gameId)),
    );
    const known = new Set(existing.map((entry) => entry.event.id));
    let localSeq = existing.reduce(
      (max, entry) => Math.max(max, entry.localSeq),
      -1,
    );
    let imported = 0;

    for (const event of events) {
      if (known.has(event.id)) continue;
      known.add(event.id);
      localSeq += 1;
      const stored: StoredEvent = {
        gameId,
        localSeq,
        status: "synced",
        event,
      };
      store.put(stored);
      imported += 1;
    }

    await done;
    return imported;
  }
}

/**
 * The projection of a stored log. The local sequence replaces the server
 * sequence, because the server may not have seen any of these events yet.
 */
export function foldStored(events: StoredEvent[]): GameState {
  return foldEvents(events.map(({ localSeq, event }) => ({ ...event, seq: localSeq })));
}
