import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalogDeleteErrorMessage,
  competitionUpdatePayload,
  playerDeleteNeedsForce,
  playerUpdatePayload,
  rosterUpdatePayload,
  seasonUpdatePayload,
  teamSeasonUpdatePayload,
  teamUpdatePayload,
  toIsoDate,
} from "@/lib/admin";
import {
  AdminApiError,
  deleteCompetition,
  deletePlayer,
  deleteRosterEntry,
  deleteSeason,
  deleteTeam,
  deleteTeamSeason,
  getTeamSeason,
  listOrganizationPlayers,
  listOrganizationTeams,
  updateCompetition,
  updatePlayer,
  updateRosterEntry,
  updateSeason,
  updateTeam,
  updateTeamSeason,
} from "@/lib/admin-api";

const TOKEN = "token-123";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi
    .fn()
    .mockImplementation(async (url: string, init: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalog payload builders", () => {
  it("normalizes season dates and trims the name", () => {
    expect(
      seasonUpdatePayload({
        name: " Temporada 2027 ",
        year: "2027",
        status: "archived",
        startsOn: "2027-03-01",
        endsOn: "2027-11-30T00:00:00.000Z",
      }),
    ).toEqual({
      name: "Temporada 2027",
      year: 2027,
      status: "archived",
      startsOn: "2027-03-01",
      endsOn: "2027-11-30",
    });
  });

  it("turns empty dates into null", () => {
    expect(toIsoDate("   ")).toBeNull();
    expect(toIsoDate("not-a-date")).toBeNull();
    expect(
      seasonUpdatePayload({
        name: "2027",
        year: "2027",
        status: "active",
        startsOn: "",
        endsOn: " ",
      }),
    ).toMatchObject({ startsOn: null, endsOn: null });
  });

  it("maps a competition edit and clears an empty parent", () => {
    expect(
      competitionUpdatePayload({
        name: " Zona Norte ",
        kind: "division",
        parentId: "",
        sortOrder: "-2",
      }),
    ).toEqual({ name: "Zona Norte", kind: "division", parentId: null, sortOrder: -2 });
  });

  it("maps team, team-season and player edits", () => {
    expect(
      teamUpdatePayload({ name: " Halcones ", slug: " halcones ", abbreviation: " " }),
    ).toEqual({ name: "Halcones", slug: "halcones", abbreviation: null });

    expect(
      teamSeasonUpdatePayload({
        name: " Tiburones ",
        abbreviation: "TIB",
        competitionId: "competition-1",
      }),
    ).toEqual({ name: "Tiburones", abbreviation: "TIB", competitionId: "competition-1" });

    expect(playerUpdatePayload({ firstName: " Ana ", lastName: " Pérez " })).toEqual({
      firstName: "Ana",
      lastName: "Pérez",
    });
  });

  it("maps a roster edit with eligibility dates and status", () => {
    expect(
      rosterUpdatePayload({
        jersey: " 27 ",
        primaryPosition: " ",
        eligibilityStart: "2026-03-01",
        eligibilityEnd: "",
        status: "inactive",
      }),
    ).toEqual({
      jersey: "27",
      primaryPosition: null,
      eligibilityStart: "2026-03-01",
      eligibilityEnd: null,
      status: "inactive",
    });
  });
});

describe("catalog delete messages", () => {
  it("explains each dependency in Spanish", () => {
    expect(
      catalogDeleteErrorMessage("season still has competitions, team seasons or games"),
    ).toContain("temporada");
    expect(
      catalogDeleteErrorMessage("competition still has team seasons or games"),
    ).toContain("competencia");
    expect(catalogDeleteErrorMessage("team still has team seasons")).toContain("equipo");
    expect(catalogDeleteErrorMessage("team season still has games")).toContain("inscripción");
    expect(catalogDeleteErrorMessage(null)).toContain("No se puede borrar");
  });

  it("detects the player force confirmation", () => {
    expect(playerDeleteNeedsForce("player still has roster entries; use force=true")).toBe(true);
    expect(playerDeleteNeedsForce("team still has team seasons")).toBe(false);
    expect(playerDeleteNeedsForce(null)).toBe(false);
  });
});

describe("organization catalog reads", () => {
  it("calls the organization teams and players endpoints", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, []));

    await listOrganizationTeams(TOKEN, "org-1");
    await listOrganizationPlayers(TOKEN, "org-1");

    const [teamUrl, teamInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [playerUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(teamUrl).toContain("/admin/organizations/org-1/teams");
    expect(playerUrl).toContain("/admin/organizations/org-1/players");
    expect(teamInit.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it("reads a team season with its roster", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, { teamSeason: { id: "ts-1" }, roster: [] }),
    );

    const view = await getTeamSeason("ts-1");

    expect(view.teamSeason.id).toBe("ts-1");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/team-seasons/ts-1");
  });
});

describe("catalog mutations", () => {
  it("patches a season", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { id: "season-1" }));

    await updateSeason(TOKEN, "season-1", {
      name: "2027",
      year: 2027,
      status: "active",
      startsOn: null,
      endsOn: null,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/seasons/season-1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(
      JSON.stringify({
        name: "2027",
        year: 2027,
        status: "active",
        startsOn: null,
        endsOn: null,
      }),
    );
  });

  it("deletes a season and translates a dependency conflict", async () => {
    mockFetch(() =>
      jsonResponse(409, {
        statusCode: 409,
        message: "season still has competitions, team seasons or games",
      }),
    );

    await expect(deleteSeason(TOKEN, "season-1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("No se puede borrar"),
    });
  });

  it("patches a competition", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { id: "competition-1" }));

    await updateCompetition(TOKEN, "competition-1", {
      name: "Zona Norte",
      kind: "division",
      parentId: null,
      sortOrder: 1,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/admin/competitions/competition-1");
    expect(init.method).toBe("PATCH");
  });

  it("keeps a 404 from a competition delete actionable", async () => {
    mockFetch(() => jsonResponse(404, { message: "competition not found" }));

    await expect(deleteCompetition(TOKEN, "competition-1")).rejects.toMatchObject({
      status: 404,
      message: expect.stringContaining("Actualiza"),
    });
  });

  it("patches and deletes a team", async () => {
    const fetchMock = mockFetch((url) =>
      jsonResponse(200, url.includes("?") ? { deleted: true } : { id: "team-1" }),
    );

    await updateTeam(TOKEN, "team-1", {
      name: "Halcones",
      slug: "halcones",
      abbreviation: "HAL",
    });
    await deleteTeam(TOKEN, "team-1");

    const [patchUrl, patchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(patchUrl).toContain("/admin/teams/team-1");
    expect(patchInit.method).toBe("PATCH");
    expect(deleteUrl).toContain("/admin/teams/team-1");
    expect(deleteInit.method).toBe("DELETE");
  });

  it("maps a 403 on a team delete", async () => {
    mockFetch(() => jsonResponse(403, { message: "organization admin role required" }));

    await expect(deleteTeam(TOKEN, "team-1")).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("permiso"),
    });
  });

  it("patches and deletes a team season", async () => {
    const fetchMock = mockFetch((url) =>
      jsonResponse(200, url.includes("team-seasons") ? { id: "ts-1" } : { deleted: true }),
    );

    await updateTeamSeason(TOKEN, "ts-1", {
      name: "Tiburones",
      abbreviation: null,
      competitionId: "competition-2",
    });
    await deleteTeamSeason(TOKEN, "ts-1");

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });

  it("translates a team-season delete conflict", async () => {
    mockFetch(() => jsonResponse(409, { message: "team season still has games" }));

    await expect(deleteTeamSeason(TOKEN, "ts-1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("juegos"),
    });
  });

  it("patches a player", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { id: "player-1" }));

    await updatePlayer(TOKEN, "player-1", { firstName: "Ana", lastName: "Pérez" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ firstName: "Ana", lastName: "Pérez" }));
  });

  it("adds force=true only for the second player delete", async () => {
    const fetchMock = mockFetch(() =>
      jsonResponse(200, { deleted: true, rosterEntriesDeleted: 2 }),
    );

    await deletePlayer(TOKEN, "player-1");
    await deletePlayer(TOKEN, "player-1", true);

    const [plainUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [forceUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(plainUrl).not.toContain("force=true");
    expect(forceUrl).toContain("/admin/players/player-1?force=true");
  });

  it("keeps the player 409 detail for the force confirmation", async () => {
    mockFetch(() =>
      jsonResponse(409, {
        message: "player still has roster entries; use force=true",
      }),
    );

    await expect(deletePlayer(TOKEN, "player-1")).rejects.toMatchObject({
      status: 409,
      detail: "player still has roster entries; use force=true",
      message: expect.stringContaining("roster"),
    });
  });

  it("patches and deletes a roster entry", async () => {
    const fetchMock = mockFetch((url) =>
      jsonResponse(200, url.includes("roster-entries") ? { id: "re-1" } : { deleted: true }),
    );

    await updateRosterEntry(TOKEN, "re-1", {
      jersey: "27",
      primaryPosition: null,
      eligibilityStart: null,
      eligibilityEnd: null,
      status: "active",
    });
    await deleteRosterEntry(TOKEN, "re-1");

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
  });

  it("keeps a generic 409 actionable", async () => {
    mockFetch(() => jsonResponse(409, { message: "unknown conflict" }));

    await expect(deleteRosterEntry(TOKEN, "re-1")).rejects.toBeInstanceOf(AdminApiError);
    await expect(deleteRosterEntry(TOKEN, "re-1")).rejects.toMatchObject({
      message: expect.stringContaining("datos asociados"),
    });
  });
});
