import type { Event, GameRecord, GameState } from "./types";

const SERVER_API_URL = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`olb-api ${status} on ${path}`);
    this.name = "ApiError";
  }
}

async function get<T>(base: string, path: string): Promise<T> {
  const response = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status, path);
  return (await response.json()) as T;
}

export function fetchGames(): Promise<GameRecord[]> {
  return get<GameRecord[]>(SERVER_API_URL, "/games");
}

export function fetchGame(id: string): Promise<GameRecord> {
  return get<GameRecord>(SERVER_API_URL, `/games/${encodeURIComponent(id)}`);
}

export function fetchState(id: string): Promise<GameState> {
  return get<GameState>(SERVER_API_URL, `/games/${encodeURIComponent(id)}/state`);
}

export function fetchEvents(id: string, fromSeq = 0): Promise<Event[]> {
  return get<Event[]>(SERVER_API_URL, `/games/${encodeURIComponent(id)}/events?fromSeq=${fromSeq}`);
}

export type GamePageData =
  | { kind: "ok"; game: GameRecord; state: GameState; events: Event[] }
  | { kind: "missing" }
  | { kind: "offline" };

export async function fetchGamePage(id: string): Promise<GamePageData> {
  try {
    const [game, state, events] = await Promise.all([
      fetchGame(id),
      fetchState(id),
      fetchEvents(id),
    ]);
    return { kind: "ok", game, state, events };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { kind: "missing" };
    return { kind: "offline" };
  }
}
