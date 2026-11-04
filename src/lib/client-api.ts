import type { BoxScore, Event, GameState } from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`olb-api ${response.status} on ${path}`);
  return (await response.json()) as T;
}

export function clientState(id: string): Promise<GameState> {
  return get<GameState>(`/games/${encodeURIComponent(id)}/state`);
}

export function clientEvents(id: string, fromSeq: number): Promise<Event[]> {
  return get<Event[]>(`/games/${encodeURIComponent(id)}/events?fromSeq=${fromSeq}`);
}

export function clientBoxScore(id: string): Promise<BoxScore> {
  return get<BoxScore>(`/games/${encodeURIComponent(id)}/boxscore`);
}
