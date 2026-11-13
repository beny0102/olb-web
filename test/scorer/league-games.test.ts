import { afterEach, describe, expect, it, vi } from "vitest";
import {
  leagueGameToLocalGame,
  prepareLeagueGame,
  scheduledGamesForMemberships,
  toRosterPlayer,
  type LeagueGame,
  type RosterEntry,
} from "../../src/lib/scorer/api";
import type { Membership } from "../../src/lib/scorer/auth";
import { DEFAULT_RULES } from "../../src/lib/scorer/rules";

const game: LeagueGame = {
  id: "0192f3a2-0100-7000-8000-000000000020",
  homeTeam: "Tiburones",
  awayTeam: "Marlins",
  scheduledStart: "2027-04-10T23:00:00.000Z",
  venue: "Estadio Centenario",
  createdAt: "2026-11-04T15:11:58.892Z",
  lastSeq: 0,
  seasonId: "0192f3a2-0100-7000-8000-000000000021",
  competitionId: "0192f3a2-0100-7000-8000-000000000022",
  homeTeamSeasonId: "0192f3a2-0100-7000-8000-000000000023",
  awayTeamSeasonId: "0192f3a2-0100-7000-8000-000000000024",
  coverage: "full",
  dataSource: "official",
  status: "scheduled",
  score: null,
  rulesProfile: null,
};

function rosterEntry(
  playerId: string,
  position: string,
  overrides: Partial<RosterEntry> = {},
): RosterEntry {
  return {
    id: `entry-${playerId}`,
    teamSeasonId: game.homeTeamSeasonId!,
    playerId,
    jersey: "7",
    primaryPosition: position,
    eligibilityStart: null,
    eligibilityEnd: null,
    status: "active",
    firstName: "Jugador",
    lastName: position,
    ...overrides,
  };
}

const homeRoster = [
  rosterEntry("0192f3a2-0100-7000-8000-000000000030", "C"),
  rosterEntry("0192f3a2-0100-7000-8000-000000000031", "1B"),
  rosterEntry("0192f3a2-0100-7000-8000-000000000032", "P", { status: "inactive" }),
];

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("toRosterPlayer", () => {
  it("uses the player UUID and the full name", () => {
    expect(toRosterPlayer(homeRoster[0]!)).toEqual({
      id: "0192f3a2-0100-7000-8000-000000000030",
      name: "Jugador C",
      position: "C",
      jersey: "7",
    });
  });
});

describe("leagueGameToLocalGame", () => {
  it("maps the league fields and both rosters", () => {
    const local = leagueGameToLocalGame(
      game,
      homeRoster,
      [rosterEntry("0192f3a2-0100-7000-8000-000000000040", "SS")],
    );

    expect(local).toMatchObject({
      id: game.id,
      homeTeam: "Tiburones",
      awayTeam: "Marlins",
      seasonId: game.seasonId,
      competitionId: game.competitionId,
      homeTeamSeasonId: game.homeTeamSeasonId,
      awayTeamSeasonId: game.awayTeamSeasonId,
      coverage: "full",
      dataSource: "official",
      status: "scheduled",
      score: null,
      lineups: { home: null, away: null },
      teamSeasonIds: {
        home: game.homeTeamSeasonId,
        away: game.awayTeamSeasonId,
      },
    });
    expect(local.rules).toEqual(DEFAULT_RULES);
    expect(local.rosters?.home).toEqual([
      {
        id: "0192f3a2-0100-7000-8000-000000000030",
        name: "Jugador C",
        position: "C",
        jersey: "7",
      },
      {
        id: "0192f3a2-0100-7000-8000-000000000031",
        name: "Jugador 1B",
        position: "1B",
        jersey: "7",
      },
    ]);
    expect(local.rosters?.away).toHaveLength(1);
  });

  it("keeps a game without both team seasons free of teamSeasonIds", () => {
    const local = leagueGameToLocalGame({ ...game, awayTeamSeasonId: null });

    expect(local.teamSeasonIds).toBeUndefined();
    expect(local.rosters).toEqual({ home: [], away: [] });
  });
});

describe("prepareLeagueGame", () => {
  it("fetches the game and both team seasons, keeping every id", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/league-games/${game.id}`)) {
        return response({ game, summary: null });
      }
      if (url.endsWith(`/team-seasons/${game.homeTeamSeasonId}`)) {
        return response({
          teamSeason: { id: game.homeTeamSeasonId },
          roster: homeRoster,
        });
      }
      if (url.endsWith(`/team-seasons/${game.awayTeamSeasonId}`)) {
        return response({
          teamSeason: { id: game.awayTeamSeasonId },
          roster: [rosterEntry("0192f3a2-0100-7000-8000-000000000041", "P")],
        });
      }
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const local = await prepareLeagueGame(game.id);

    expect(local.id).toBe(game.id);
    expect(local.teamSeasonIds).toEqual({
      home: game.homeTeamSeasonId,
      away: game.awayTeamSeasonId,
    });
    expect(local.rosters?.home.map((player) => player.id)).toEqual([
      "0192f3a2-0100-7000-8000-000000000030",
      "0192f3a2-0100-7000-8000-000000000031",
    ]);
    expect(local.rosters?.away[0]?.id).toBe(
      "0192f3a2-0100-7000-8000-000000000041",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("scheduledGamesForMemberships", () => {
  const teamMembership: Membership = {
    id: "membership-1",
    userId: "user-1",
    scopeType: "team_season",
    scopeId: game.homeTeamSeasonId!,
    role: "scorer",
    createdAt: "2026-11-04T15:00:00.000Z",
  };

  it("keeps only scheduled games where the user has a membership", () => {
    const finalGame: LeagueGame = { ...game, status: "final", score: { home: 3, away: 1 } };
    const otherGame: LeagueGame = {
      ...game,
      id: "0192f3a2-0100-7000-8000-000000000099",
      homeTeamSeasonId: "other-home",
      awayTeamSeasonId: "other-away",
    };

    expect(
      scheduledGamesForMemberships(
        [game, finalGame, otherGame],
        [teamMembership],
        null,
      ).map((entry) => entry.id),
    ).toEqual([game.id]);
  });

  it("lets an organization admin see every scheduled game", () => {
    const organizationMembership: Membership = {
      ...teamMembership,
      scopeType: "organization",
      scopeId: "organization-1",
      role: "org_admin",
    };

    expect(
      scheduledGamesForMemberships([game], [organizationMembership], "organization-1"),
    ).toEqual([game]);
  });

  it("does not give a verifier the admin view", () => {
    const verifier: Membership = {
      ...teamMembership,
      scopeType: "competition",
      scopeId: game.competitionId!,
      role: "verifier",
    };

    expect(scheduledGamesForMemberships([game], [verifier], "organization-1")).toEqual([]);
  });
});
