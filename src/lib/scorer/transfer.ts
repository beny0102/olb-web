import type { Event } from "@olb/contract/types";
import type { GameStore } from "./db";
import { localStore } from "./store";
import type { LocalGame, StoredEvent } from "./types";

/** Versioned envelope of the local scorer archive. */
export const LOCAL_BUNDLE_FORMAT = "olb.local-games/1";

export interface LocalBundleGame {
  game: LocalGame;
  /** The local log as it was exported, including `pending` / `synced`. */
  events: StoredEvent[];
}

export interface LocalBundle {
  format: typeof LOCAL_BUNDLE_FORMAT;
  exportedAt: string;
  games: LocalBundleGame[];
}

export interface ImportSummary {
  /** Games written because this device did not have them. */
  games: number;
  /** Events appended because their `id` was not in the local log. */
  events: number;
  /** Games already present plus events already present. */
  skipped: number;
}

const INVALID_BUNDLE =
  "El archivo no es un paquete de partidas locales válido.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isNullableText(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function assertLineup(value: unknown): void {
  if (value === null) return;
  if (!isRecord(value) || !Array.isArray(value.players) || !isText(value.pitcherId)) {
    throw new Error(INVALID_BUNDLE);
  }
  if (value.team !== "home" && value.team !== "away") {
    throw new Error(INVALID_BUNDLE);
  }

  for (const player of value.players) {
    if (
      !isRecord(player) ||
      !isText(player.id) ||
      !isText(player.name) ||
      typeof player.position !== "string" ||
      typeof player.battingSlot !== "number"
    ) {
      throw new Error(INVALID_BUNDLE);
    }
  }
}

function assertGame(value: unknown): asserts value is LocalGame {
  if (
    !isRecord(value) ||
    !isText(value.id) ||
    typeof value.homeTeam !== "string" ||
    typeof value.awayTeam !== "string" ||
    !isNullableText(value.scheduledStart) ||
    !isNullableText(value.venue) ||
    !isText(value.createdAt) ||
    !isRecord(value.lineups) ||
    !("home" in value.lineups) ||
    !("away" in value.lineups)
  ) {
    throw new Error(INVALID_BUNDLE);
  }

  assertLineup(value.lineups.home);
  assertLineup(value.lineups.away);
}

function assertStoredEvent(value: unknown, gameId: string): asserts value is StoredEvent {
  if (
    !isRecord(value) ||
    !isRecord(value.event) ||
    !isText(value.event.id) ||
    value.event.gameId !== gameId ||
    !isText(value.event.type) ||
    typeof value.event.seq !== "number" ||
    !Number.isFinite(value.event.seq) ||
    (value.status !== "pending" && value.status !== "synced") ||
    typeof value.localSeq !== "number" ||
    !Number.isFinite(value.localSeq)
  ) {
    throw new Error(INVALID_BUNDLE);
  }

  // The envelope belongs to the contract; keeping it explicit avoids
  // importing a JSON file that merely looks like a local log.
  if (value.event.contract !== "olb.event/1") {
    throw new Error(INVALID_BUNDLE);
  }
}

/**
 * Validates an unknown value against `olb.local-games/1`. It returns a fresh
 * object: callers may keep the parsed bundle without trusting the input.
 */
export function readLocalBundle(value: unknown): LocalBundle {
  if (
    !isRecord(value) ||
    value.format !== LOCAL_BUNDLE_FORMAT ||
    !isText(value.exportedAt) ||
    !Array.isArray(value.games)
  ) {
    throw new Error(INVALID_BUNDLE);
  }

  const games: LocalBundleGame[] = value.games.map((entry) => {
    if (!isRecord(entry) || !Array.isArray(entry.events)) {
      throw new Error(INVALID_BUNDLE);
    }
    assertGame(entry.game);

    for (const event of entry.events) assertStoredEvent(event, entry.game.id);

    return {
      game: structuredClone(entry.game),
      events: structuredClone(entry.events),
    };
  });

  return {
    format: LOCAL_BUNDLE_FORMAT,
    exportedAt: value.exportedAt,
    games,
  };
}

/**
 * Reads every local game and its full log. Events keep their local status so
 * the archive is a faithful copy, not only the pending outbox.
 */
export async function exportLocalBundle(
  store: GameStore = localStore(),
): Promise<LocalBundle> {
  const games = await store.listGames();
  const entries: LocalBundleGame[] = [];

  for (const game of games) {
    entries.push({ game, events: await store.listEvents(game.id) });
  }

  return {
    format: LOCAL_BUNDLE_FORMAT,
    exportedAt: new Date().toISOString(),
    games: entries,
  };
}

/**
 * Merges a bundle into the local store. Existing games are never rewritten and
 * existing events are never deleted or renumbered: imported log entries are
 * appended as pending from the current local maximum.
 */
export async function importLocalBundle(
  value: unknown,
  store: GameStore = localStore(),
): Promise<ImportSummary> {
  const bundle = readLocalBundle(value);
  let games = 0;
  let events = 0;
  let skipped = 0;

  for (const entry of bundle.games) {
    const existingGame = await store.getGame(entry.game.id);
    if (existingGame) {
      skipped += 1;
    } else {
      await store.putGame(entry.game);
      games += 1;
    }

    const known = new Set(
      (await store.listEvents(entry.game.id)).map((stored) => stored.event.id),
    );
    for (const stored of entry.events) {
      if (known.has(stored.event.id)) {
        skipped += 1;
        continue;
      }
      // `appendEvent` assigns the next local sequence and pending status, so a
      // log from another device never collides with this one.
      await store.appendEvent(entry.game.id, stored.event as Event);
      known.add(stored.event.id);
      events += 1;
    }
  }

  return { games, events, skipped };
}
