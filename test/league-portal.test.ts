import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coverageLabel,
  fetchPortalData,
  gameStatus,
  isSummaryGame,
  ledgerScore,
  scoreOf,
  visibleStandingGroups,
  type PortalGame,
} from "@/lib/league";
import type {
  GameRecord,
  GameState,
  LeagueCompetition,
  LeagueGame,
  LeagueSeason,
  LeagueStandingGroup,
  LeagueTeamSeason,
} from "@/lib/types";

function response(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as unknown as Response;
}

function state(status: GameState["status"]): GameState {
  return {
    status,
    inning: 1,
    half: "top",
    outs: 0,
    count: { balls: 0, strikes: 0 },
    bases: { first: null, second: null, third: null },
    score: { home: 0, away: 0 },
    battingTeam: "away",
    lastSeq: 0,
  };
}

const SEASON: LeagueSeason = {
  id: "season-1",
  organizationId: "org-1",
  name: "2026",
  year: 2026,
  status: "active",
  startsOn: "2026-03-01",
  endsOn: "2026-11-30",
};

const COMPETITION: LeagueCompetition = {
  id: "comp-1",
  seasonId: SEASON.id,
  parentId: null,
  name: "Zona Norte",
  kind: "division",
  level: 1,
  sortOrder: 1,
};

const TEAM: LeagueTeamSeason = {
  id: "team-season-1",
  teamId: "team-1",
  seasonId: SEASON.id,
  competitionId: COMPETITION.id,
  name: "Tiburones",
  abbreviation: "TIB",
  teamName: "Tiburones",
  competitionName: COMPETITION.name,
};

const STANDINGS: LeagueStandingGroup[] = [
  {
    competitionId: COMPETITION.id,
    competitionName: COMPETITION.name,
    teams: [
      {
        teamSeasonId: TEAM.id,
        team: "Tiburones",
        w: 1,
        l: 0,
        runsFor: 5,
        runsAgainst: 3,
        pct: 1,
        gamesPlayed: 1,
      },
      {
        teamSeasonId: "team-season-2",
        team: "Faros",
        w: 0,
        l: 1,
        runsFor: 3,
        runsAgainst: 5,
        pct: 0,
        gamesPlayed: 1,
      },
    ],
  },
];

function record(id: string): GameRecord {
  return {
    id,
    homeTeam: "Tiburones",
    awayTeam: "Faros",
    scheduledStart: null,
    venue: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastSeq: -1,
  };
}

function leagueGame(
  id: string,
  coverage: LeagueGame["coverage"],
  status: LeagueGame["status"],
  score: LeagueGame["score"],
): LeagueGame {
  return {
    ...record(id),
    seasonId: SEASON.id,
    competitionId: COMPETITION.id,
    homeTeamSeasonId: TEAM.id,
    awayTeamSeasonId: "team-season-2",
    coverage,
    dataSource: coverage === "summary" ? "import" : "official",
    rulesProfile: null,
    status,
    score,
  };
}

function portalGame(
  coverage: LeagueGame["coverage"],
  status: LeagueGame["status"],
  score: LeagueGame["score"],
  status_ = "final",
): PortalGame {
  return {
    game: record(`game-${coverage}`),
    state: state(status_ as GameState["status"]),
    events: [],
    league: leagueGame(`game-${coverage}`, coverage, status, score),
  };
}

describe("league status and score", () => {
  it("marks a summary game final and reads its stored score", () => {
    const entry = portalGame("summary", "final", { home: 5, away: 3 }, "scheduled");

    expect(gameStatus(entry)).toBe("final");
    expect(scoreOf(entry)).toEqual({ home: 5, away: 3 });
    expect(isSummaryGame(entry)).toBe(true);
    expect(coverageLabel(entry)).toBe("Resumen");
    expect(ledgerScore(entry)).toBe("FAR 3, TIB 5");
  });

  it("prefers the league projection over a stale event state", () => {
    const entry = portalGame("full", "live", { home: 2, away: 1 }, "final");

    expect(gameStatus(entry)).toBe("live");
    expect(scoreOf(entry)).toEqual({ home: 2, away: 1 });
    expect(isSummaryGame(entry)).toBe(false);
  });

  it("keeps the legacy event state when the game has no league row", () => {
    const entry: PortalGame = {
      ...portalGame("full", "final", { home: 1, away: 0 }),
      league: undefined,
    };
    entry.state = { ...state("final"), score: { home: 4, away: 2 } };

    expect(gameStatus(entry)).toBe("final");
    expect(scoreOf(entry)).toEqual({ home: 4, away: 2 });
    expect(isSummaryGame(entry)).toBe(false);
  });
});

describe("standings groups", () => {
  it("keeps one table per competition with at least two clubs", () => {
    const single = {
      competitionId: "comp-2",
      competitionName: "Zona Sur",
      teams: [STANDINGS[0]!.teams[0]!],
    };
    const visible = visibleStandingGroups([...STANDINGS, single]);

    expect(visible.map((group) => group.competitionName)).toEqual(["Zona Norte"]);
  });
});

describe("fetchPortalData league mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps seasons, competitions, teams, games and groups from the league API", async () => {
    const summary = leagueGame("game-summary", "summary", "final", { home: 5, away: 3 });
    const full = leagueGame("game-full", "full", "scheduled", null);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      switch (path) {
        case "/health":
          return response({ status: "ok", contract: "0.1.0", storage: "postgres", time: "now" });
        case "/seasons":
          return response([SEASON]);
        case `/seasons/${SEASON.id}/competitions`:
          return response([COMPETITION]);
        case `/seasons/${SEASON.id}/games`:
          return response([summary, full]);
        case `/seasons/${SEASON.id}/standings`:
          return response(STANDINGS);
        case `/competitions/${COMPETITION.id}/teams`:
          return response([TEAM]);
        case `/games/${full.id}/state`:
          return response(state("scheduled"));
        case `/games/${full.id}/events`:
          return response([]);
        default:
          return response({}, 404);
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchPortalData();

    expect(data).not.toBeNull();
    expect(data?.season?.id).toBe(SEASON.id);
    expect(data?.seasons).toHaveLength(1);
    expect(data?.competitions.map((row) => row.name)).toEqual(["Zona Norte"]);
    expect(data?.teams.map((row) => row.teamName)).toEqual(["Tiburones"]);
    expect(data?.standingGroups).toEqual(STANDINGS);
    expect(data?.games).toHaveLength(2);

    const summaryBundle = data?.games.find((entry) => entry.game.id === summary.id);
    expect(summaryBundle?.league?.coverage).toBe("summary");
    expect(summaryBundle?.state).toBeNull();
    expect(scoreOf(summaryBundle!)).toEqual({ home: 5, away: 3 });

    const fullBundle = data?.games.find((entry) => entry.game.id === full.id);
    expect(fullBundle?.league?.coverage).toBe("full");
    expect(fullBundle?.state?.status).toBe("scheduled");
  });

  it("falls back to the legacy games and standings when the league catalog is missing", async () => {
    const legacy = record("legacy-1");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      switch (path) {
        case "/health":
          return response({ status: "ok", contract: "0.1.0", storage: "memory", time: "now" });
        case "/seasons":
          return response({}, 500);
        case "/games":
          return response([legacy]);
        case "/standings":
          return response({
            games: 1,
            teams: [
              { team: "Tiburones", w: 1, l: 0, runsFor: 5, runsAgainst: 3, pct: 1 },
              { team: "Faros", w: 0, l: 1, runsFor: 3, runsAgainst: 5, pct: 0 },
            ],
          });
        case `/games/${legacy.id}/state`:
          return response(state("final"));
        case `/games/${legacy.id}/events`:
          return response([]);
        default:
          return response({}, 404);
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchPortalData();

    expect(data).not.toBeNull();
    expect(data?.season).toBeNull();
    expect(data?.seasons).toEqual([]);
    expect(data?.games).toHaveLength(1);
    expect(data?.games[0]?.league).toBeUndefined();
    expect(data?.standingGroups).toHaveLength(1);
    expect(data?.standingGroups[0]?.competitionName).toBe("");
    expect(data?.standingGroups[0]?.teams.map((row) => row.team)).toEqual([
      "Tiburones",
      "Faros",
    ]);
  });

  it("returns null only when both the league and legacy paths fail", async () => {
    const fetchMock = vi.fn(async () => response({}, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPortalData()).resolves.toBeNull();
  });
});
