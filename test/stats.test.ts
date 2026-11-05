import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSeasonStats } from "@/lib/league-api";
import { fetchSeasonStatsPage, selectSeason } from "@/lib/stats";
import type {
  LeagueBattingLeader,
  LeaguePitchingLeader,
  LeagueSeason,
  LeagueSeasonStats,
  LeagueStandingGroup,
} from "@/lib/types";

function response(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => value,
  } as unknown as Response;
}

const ARCHIVED: LeagueSeason = {
  id: "season-1",
  organizationId: "org-1",
  name: "2025",
  year: 2025,
  status: "archived",
  startsOn: "2025-03-01",
  endsOn: "2025-11-30",
};

const ACTIVE: LeagueSeason = {
  ...ARCHIVED,
  id: "season-2",
  name: "2026",
  year: 2026,
  status: "active",
  startsOn: "2026-03-01",
  endsOn: "2026-11-30",
};

const BATTING: LeagueBattingLeader[] = [
  {
    playerId: "player-1",
    player: "Ana Ríos",
    teamSeasonId: "team-season-1",
    team: "Tiburones",
    jersey: "7",
    position: "CF",
    pa: 12,
    ab: 10,
    h: 4,
    hr: 1,
    rbi: 3,
    r: 2,
    bb: 2,
    so: 1,
    hbp: 0,
    avg: 0.4,
  },
  {
    playerId: "player-2",
    player: "Luis Marín",
    teamSeasonId: "team-season-2",
    team: "Faros",
    jersey: null,
    position: null,
    pa: 3,
    ab: 0,
    h: 0,
    hr: 0,
    rbi: 0,
    r: 1,
    bb: 3,
    so: 0,
    hbp: 0,
    avg: null,
  },
];

const PITCHING: LeaguePitchingLeader[] = [
  {
    playerId: "player-3",
    player: "Eva Soto",
    teamSeasonId: "team-season-1",
    team: "Tiburones",
    jersey: "18",
    position: "P",
    pitches: 88,
    so: 9,
    bb: 2,
    appearances: 2,
  },
];

const GROUPS: LeagueStandingGroup[] = [
  {
    competitionId: "comp-1",
    competitionName: "Zona Norte",
    teams: [
      {
        teamSeasonId: "team-season-1",
        team: "Tiburones",
        w: 2,
        l: 0,
        runsFor: 9,
        runsAgainst: 4,
        pct: 1,
        gamesPlayed: 2,
      },
      {
        teamSeasonId: "team-season-2",
        team: "Faros",
        w: 0,
        l: 2,
        runsFor: 4,
        runsAgainst: 9,
        pct: 0,
        gamesPlayed: 2,
      },
    ],
  },
];

const STATS: LeagueSeasonStats = {
  seasonId: ACTIVE.id,
  groups: GROUPS,
  batting: BATTING,
  pitching: PITCHING,
};

describe("selectSeason", () => {
  it("honours the requested season", () => {
    expect(selectSeason([ARCHIVED, ACTIVE], ARCHIVED.id)?.id).toBe(ARCHIVED.id);
  });

  it("falls back to the active season and then to the first listed", () => {
    expect(selectSeason([ARCHIVED, ACTIVE])?.id).toBe(ACTIVE.id);
    expect(selectSeason([ARCHIVED])?.id).toBe(ARCHIVED.id);
    expect(selectSeason([ARCHIVED], "missing")?.id).toBe(ARCHIVED.id);
  });

  it("returns null for an empty catalog", () => {
    expect(selectSeason([])).toBeNull();
  });
});

describe("fetchSeasonStats", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scopes the read to a competition when requested", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => response(STATS));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSeasonStats(ACTIVE.id, "comp-1");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe(`/seasons/${ACTIVE.id}/stats`);
    expect(url.searchParams.get("competitionId")).toBe("comp-1");
  });
});

describe("fetchSeasonStatsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps season stats, including a null average and empty groups", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/seasons") return response([ARCHIVED, ACTIVE]);
      if (url.pathname === `/seasons/${ACTIVE.id}/stats`) return response(STATS);
      return response({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchSeasonStatsPage();

    expect(data.season?.id).toBe(ACTIVE.id);
    expect(data.stats).toEqual(STATS);
    expect(data.stats?.batting[1]?.avg).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps an honest empty result instead of inventing leaders", async () => {
    const empty: LeagueSeasonStats = {
      seasonId: ACTIVE.id,
      groups: [],
      batting: [],
      pitching: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/seasons") return response([ACTIVE]);
      if (url.pathname === `/seasons/${ACTIVE.id}/stats`) return response(empty);
      return response({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchSeasonStatsPage();

    expect(data.stats).toEqual(empty);
    expect(data.stats?.batting).toEqual([]);
    expect(data.stats?.pitching).toEqual([]);
  });

  it("returns the season with null stats when the stats read fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/seasons") return response([ACTIVE]);
      return response({}, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchSeasonStatsPage();

    expect(data.season?.id).toBe(ACTIVE.id);
    expect(data.stats).toBeNull();
  });

  it("returns an empty catalog when the seasons read fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({}, 500)));

    const data = await fetchSeasonStatsPage();

    expect(data).toEqual({ seasons: [], season: null, stats: null });
  });
});
