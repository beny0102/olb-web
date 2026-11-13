import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "@olb/contract/types";
import { ApiError, appendEvent } from "../../src/lib/scorer/api";
import { MemoryGameStore } from "../../src/lib/scorer/db";
import { gameStart, pitch } from "../../src/lib/scorer/events";
import { syncGame } from "../../src/lib/scorer/sync";
import { uuid7 } from "../../src/lib/scorer/uuid7";

vi.mock("../../src/lib/scorer/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/scorer/api")>();
  return { ...actual, appendEvent: vi.fn() };
});

const appendMock = vi.mocked(appendEvent);
const gameId = uuid7();

function fixtures(): Event[] {
  return [
    gameStart(gameId, 0),
    pitch(gameId, 1, {
      pitchNo: 1,
      batter: uuid7(),
      pitcher: uuid7(),
      count: { balls: 0, strikes: 0 },
      call: "B",
    }),
    pitch(gameId, 2, {
      pitchNo: 2,
      batter: uuid7(),
      pitcher: uuid7(),
      count: { balls: 1, strikes: 0 },
      call: "S",
    }),
  ];
}

async function storeWith(events: Event[]): Promise<MemoryGameStore> {
  const store = new MemoryGameStore();
  for (const event of events) {
    await store.appendEvent(gameId, event);
  }
  return store;
}

beforeEach(() => {
  appendMock.mockReset();
});

describe("syncGame", () => {
  it("uploads pending events in local order and marks them synced", async () => {
    const events = fixtures().slice(1);
    const store = await storeWith(events);
    appendMock.mockImplementation(async (_gameId, event) => event);

    const result = await syncGame(store, gameId);

    expect(result).toEqual({
      synced: 2,
      pending: 0,
      error: null,
      retryable: false,
      offline: false,
    });
    expect(appendMock.mock.calls.map(([, event]) => event.id)).toEqual(
      events.map((event) => event.id),
    );
    expect(await store.pendingEvents(gameId)).toHaveLength(0);
    expect((await store.listEvents(gameId)).map((entry) => entry.status)).toEqual([
      "synced",
      "synced",
    ]);
  });

  it("stops on a 500, keeps the outbox and allows a retry", async () => {
    const store = await storeWith(fixtures().slice(1));
    appendMock.mockRejectedValue(
      new ApiError(500, "El servidor tuvo un problema. Inténtalo de nuevo."),
    );

    const result = await syncGame(store, gameId);

    expect(result.synced).toBe(0);
    expect(result.pending).toBe(2);
    expect(result.retryable).toBe(true);
    expect(result.offline).toBe(false);
    expect(result.error).toBe("El servidor tuvo un problema. Inténtalo de nuevo.");
    expect(appendMock).toHaveBeenCalledTimes(1);
    expect(await store.pendingEvents(gameId)).toHaveLength(2);
  });

  it("stops on a 409 with the API message and no retry", async () => {
    const store = await storeWith(fixtures().slice(1));
    const message = "El evento no encaja con la secuencia del servidor.";
    appendMock.mockRejectedValue(new ApiError(409, message));

    const result = await syncGame(store, gameId);

    expect(result.synced).toBe(0);
    expect(result.pending).toBe(2);
    expect(result.retryable).toBe(false);
    expect(result.offline).toBe(false);
    expect(result.error).toBe(message);
    expect(await store.pendingEvents(gameId)).toHaveLength(2);
  });
});
