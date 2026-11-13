import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiBase,
  createGame,
  createProposal,
  fetchJson,
  getGame,
  getGameState,
  listGameEvents,
  listGames,
  listProposals,
  resolveProposal,
  toLocalGame,
  type ApiGame,
  type Proposal,
} from "../../src/lib/scorer/api";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";

const game: ApiGame = {
  id: "0192f3a2-0100-7000-8000-000000000002",
  homeTeam: "Tiburones",
  awayTeam: "Marlins",
  scheduledStart: "2027-04-10T23:00:00.000Z",
  venue: "Estadio Centenario",
  createdAt: "2026-11-04T15:11:58.892Z",
  lastSeq: 0,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchMock(handler: () => Response | Promise<Response>) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => handler());
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiBase", () => {
  it("falls back to the local API in Node", () => {
    expect(apiBase()).toBe("http://localhost:3001");
  });
});

describe("fetchJson", () => {
  it("sends JSON and returns the parsed body", async () => {
    const mock = fetchMock(() => response({ ok: true }));
    vi.stubGlobal("fetch", mock);

    const body = await fetchJson<{ ok: boolean }>("/health");

    expect(body).toEqual({ ok: true });
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/health");
    expect(init.headers).toMatchObject({ "content-type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns 409 into a Spanish ApiError", async () => {
    vi.stubGlobal("fetch", fetchMock(() => response({ message: "conflict" }, 409)));

    await expect(fetchJson("/games")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "Ese juego ya existe o ya tiene eventos.",
    });
  });

  it("turns 500 into a Spanish ApiError", async () => {
    vi.stubGlobal("fetch", fetchMock(() => response({ message: "boom" }, 500)));

    await expect(fetchJson("/games")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "El servidor tuvo un problema. Inténtalo de nuevo.",
    });
  });

  it("reports a network failure as status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(fetchJson("/games")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      message: "No pudimos conectar con el servidor. Revisa tu conexión.",
    });
  });

  it("keeps the ApiError instance for the caller", async () => {
    vi.stubGlobal("fetch", fetchMock(() => response({}, 404)));

    const error = await fetchJson("/games/missing").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });
});

describe("game endpoints", () => {
  it("lists games", async () => {
    const mock = fetchMock(() => response([game]));
    vi.stubGlobal("fetch", mock);

    await expect(listGames()).resolves.toEqual([game]);
    expect(mock.mock.calls[0]?.[0]).toBe("http://localhost:3001/games");
  });

  it("gets one game and its state", async () => {
    const mock = fetchMock(() => response(game));
    vi.stubGlobal("fetch", mock);

    await expect(getGame(game.id)).resolves.toEqual(game);
    expect(mock.mock.calls[0]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}`,
    );

    const stateMock = fetchMock(() =>
      response({
        status: "scheduled",
        inning: 1,
        half: "top",
        outs: 0,
        count: { balls: 0, strikes: 0 },
        bases: { first: null, second: null, third: null },
        score: { home: 0, away: 0 },
        battingTeam: "away",
        lastSeq: 0,
      }),
    );
    vi.stubGlobal("fetch", stateMock);

    await expect(getGameState(game.id)).resolves.toMatchObject({
      status: "scheduled",
      lastSeq: 0,
    });
    expect(stateMock.mock.calls[0]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}/state`,
    );
  });

  it("lists the server log from a sequence", async () => {
    const mock = fetchMock(() => response([{ id: "event-1", seq: 5 }]));
    vi.stubGlobal("fetch", mock);

    await expect(listGameEvents(game.id, 5)).resolves.toEqual([
      { id: "event-1", seq: 5 },
    ]);
    expect(mock.mock.calls[0]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}/events?fromSeq=5`,
    );

    await listGameEvents(game.id);
    expect(mock.mock.calls[1]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}/events?fromSeq=0`,
    );
  });

  it("creates a game with POST and only the provided optional fields", async () => {
    const mock = fetchMock(() => response(game));
    vi.stubGlobal("fetch", mock);

    await expect(
      createGame({
        homeTeam: "Tiburones",
        awayTeam: "Marlins",
        venue: "Estadio Centenario",
      }),
    ).resolves.toEqual(game);

    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/games");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      homeTeam: "Tiburones",
      awayTeam: "Marlins",
      venue: "Estadio Centenario",
    });
  });

  it("omits empty optional fields", async () => {
    const mock = fetchMock(() => response(game));
    vi.stubGlobal("fetch", mock);

    await createGame({
      homeTeam: "Tiburones",
      awayTeam: "Marlins",
      scheduledStart: null,
      venue: "   ",
    });

    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      homeTeam: "Tiburones",
      awayTeam: "Marlins",
    });
  });
});

describe("proposal endpoints", () => {
  const proposal: Proposal = {
    id: "0192f3a2-0100-7000-8000-000000000010",
    gameId: game.id,
    createdAt: "2026-11-04T15:12:00.000Z",
    author: "Verificador",
    status: "open",
    payload: { kind: "pitch", call: "S" },
  };

  it("creates a proposal with the author and the payload", async () => {
    const mock = fetchMock(() => response(proposal, 201));
    vi.stubGlobal("fetch", mock);

    await expect(
      createProposal(game.id, { kind: "pitch", call: "S" }, "Verificador"),
    ).resolves.toEqual(proposal);

    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://localhost:3001/games/${game.id}/proposals`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      author: "Verificador",
      payload: { kind: "pitch", call: "S" },
    });
  });

  it("lists open proposals by default and filters by status", async () => {
    const mock = fetchMock(() => response([proposal]));
    vi.stubGlobal("fetch", mock);

    await expect(listProposals(game.id)).resolves.toEqual([proposal]);
    expect(mock.mock.calls[0]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}/proposals?status=open`,
    );

    await listProposals(game.id, "rejected");
    expect(mock.mock.calls[1]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}/proposals?status=rejected`,
    );

    await listProposals(game.id, "all");
    expect(mock.mock.calls[2]?.[0]).toBe(
      `http://localhost:3001/games/${game.id}/proposals?status=all`,
    );
  });

  it("resolves a proposal with the decision body", async () => {
    const mock = fetchMock(() => response({ ...proposal, status: "accepted" }));
    vi.stubGlobal("fetch", mock);

    await expect(resolveProposal(game.id, proposal.id, "accepted")).resolves.toMatchObject({
      status: "accepted",
    });

    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3001/games/${game.id}/proposals/${proposal.id}/resolve`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ status: "accepted" });
  });

  it("propagates the status when the game is missing", async () => {
    vi.stubGlobal("fetch", fetchMock(() => response({}, 404)));

    await expect(listProposals("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });
});

describe("toLocalGame", () => {
  it("imports a remote game with empty lineups", () => {
    expect(toLocalGame(game)).toEqual({
      id: game.id,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      scheduledStart: game.scheduledStart,
      venue: game.venue,
      createdAt: game.createdAt,
      lineups: { home: null, away: null },
      rules: DEFAULT_RULES,
    });
  });
});
