import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importLeague,
  importRoster,
  exportLeague,
  AdminApiError,
} from "@/lib/admin-api";
import {
  bundleSummaryRows,
  exportFileName,
  exportLeagueErrorMessage,
  formatFileSize,
  importConflicts,
  importDiffRows,
  importLeagueErrorMessage,
  importPayloadCode,
  leagueBundleMetadata,
  onboardingChecklist,
  onboardingReady,
  parseLeagueBundleText,
  parseRosterCsv,
  rosterCsvPayload,
  rosterImportErrorMessage,
  summarizeBundle,
  type LeagueBundle,
  type LeagueImportResult,
} from "@/lib/admin-transfer";

const TOKEN = "token-123";
const TEAM_SEASON_ID = "0192f3d0-0000-7000-8002-000000000010";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi
    .fn()
    .mockImplementation(async (url: string, init: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function sampleBundle(): LeagueBundle {
  return {
    format: "olb.league/1",
    exportedAt: "2026-11-12T10:00:00.000Z",
    organization: { slug: "liga-demo", name: "Liga Demo" },
    seasons: [
      {
        id: "season-1",
        year: 2026,
        name: "Temporada 2026",
        status: "active",
        startsOn: null,
        endsOn: null,
        competitions: [
          {
            id: "competition-1",
            name: "Serie A",
            kind: "league",
            parentId: null,
            level: 1,
            sortOrder: 1,
          },
        ],
      },
    ],
    teams: [
      { id: "team-1", name: "Tigres", slug: "tigres", abbreviation: "TIG" },
      { id: "team-2", name: "Águilas", slug: "aguilas", abbreviation: null },
    ],
    teamSeasons: [
      {
        id: "team-season-1",
        teamId: "team-1",
        seasonId: "season-1",
        competitionId: "competition-1",
        name: "Tigres",
        abbreviation: "TIG",
        roster: [
          {
            id: "roster-1",
            player: { id: "player-1", firstName: "Ana", lastName: "García" },
            jersey: "12",
            primaryPosition: "SS",
            eligibilityStart: null,
            eligibilityEnd: null,
            status: "active",
          },
        ],
      },
      {
        id: "team-season-2",
        teamId: "team-2",
        seasonId: "season-1",
        competitionId: "competition-1",
        name: "Águilas",
        abbreviation: null,
        roster: [
          {
            id: "roster-2",
            player: { id: "player-2", firstName: "Luis", lastName: "Pérez" },
            jersey: null,
            primaryPosition: null,
            eligibilityStart: null,
            eligibilityEnd: null,
            status: "active",
          },
          {
            id: "roster-3",
            player: { id: "player-1", firstName: "Ana", lastName: "García" },
            jersey: null,
            primaryPosition: null,
            eligibilityStart: null,
            eligibilityEnd: null,
            status: "inactive",
          },
        ],
      },
    ],
    games: [
      {
        id: "game-1",
        seasonId: "season-1",
        competitionId: "competition-1",
        homeTeamSeasonId: "team-season-1",
        awayTeamSeasonId: "team-season-2",
        scheduledStart: "2026-11-20T18:00:00.000Z",
        venue: "Campo 1",
        coverage: "manual",
        dataSource: "admin",
        rulesProfile: null,
      },
    ],
  };
}

function sampleImportResult(dryRun: boolean): LeagueImportResult {
  return {
    dryRun,
    created: {
      seasons: 1,
      competitions: 1,
      teams: 2,
      teamSeasons: 2,
      players: 2,
      rosterEntries: 3,
      games: 1,
    },
    updated: {
      seasons: 0,
      competitions: 0,
      teams: 0,
      teamSeasons: 0,
      players: 0,
      rosterEntries: 1,
      games: 0,
    },
    unchanged: {
      seasons: 0,
      competitions: 0,
      teams: 0,
      teamSeasons: 0,
      players: 0,
      rosterEntries: 2,
      games: 0,
    },
    conflicts: [],
    warnings: [],
  };
}

describe("bundle summary and metadata", () => {
  it("counts nested competitions and unique players", () => {
    expect(summarizeBundle(sampleBundle())).toEqual({
      seasons: 1,
      competitions: 1,
      teams: 2,
      teamSeasons: 2,
      players: 2,
      rosterEntries: 3,
      games: 1,
    });
  });

  it("tolerates malformed bundles", () => {
    expect(summarizeBundle(null)).toEqual({
      seasons: 0,
      competitions: 0,
      teams: 0,
      teamSeasons: 0,
      players: 0,
      rosterEntries: 0,
      games: 0,
    });
  });

  it("exposes the metadata shown before importing", () => {
    expect(leagueBundleMetadata(sampleBundle())).toEqual({
      format: "olb.league/1",
      organizationSlug: "liga-demo",
      organizationName: "Liga Demo",
      exportedAt: "2026-11-12T10:00:00.000Z",
      summary: {
        seasons: 1,
        competitions: 1,
        teams: 2,
        teamSeasons: 2,
        players: 2,
        rosterEntries: 3,
        games: 1,
      },
    });
  });

  it("builds Spanish summary rows", () => {
    const rows = bundleSummaryRows(summarizeBundle(sampleBundle()));
    expect(rows.map((row) => row.label)).toEqual([
      "Temporadas",
      "Competencias",
      "Equipos",
      "Inscripciones",
      "Jugadores",
      "Entradas de roster",
      "Juegos",
    ]);
    expect(rows.find((row) => row.key === "players")?.value).toBe(2);
  });
});

describe("bundle parsing", () => {
  it("rejects empty and invalid JSON with Spanish messages", () => {
    expect(parseLeagueBundleText("   ").error).toBe("El archivo está vacío.");
    expect(parseLeagueBundleText("{oops").error).toBe("El archivo no es un JSON válido.");
  });

  it("rejects a different format", () => {
    const parsed = parseLeagueBundleText(JSON.stringify({ format: "other", organization: {} }));
    expect(parsed.bundle).toBeNull();
    expect(parsed.error).toContain("olb.league/1");
  });

  it("rejects a bundle without an organization slug", () => {
    const parsed = parseLeagueBundleText(
      JSON.stringify({ format: "olb.league/1", organization: { name: "Liga" } }),
    );
    expect(parsed.bundle).toBeNull();
    expect(parsed.error).toContain("organización");
  });

  it("parses a valid bundle", () => {
    const parsed = parseLeagueBundleText(JSON.stringify(sampleBundle()));
    expect(parsed.error).toBeNull();
    expect(parsed.bundle?.organization.slug).toBe("liga-demo");
  });
});

describe("import diff formatting", () => {
  it("maps every count to a Spanish row", () => {
    const rows = importDiffRows(sampleImportResult(true));
    expect(rows).toHaveLength(7);
    expect(rows.find((row) => row.key === "rosterEntries")).toEqual({
      key: "rosterEntries",
      label: "Entradas de roster",
      created: 3,
      updated: 1,
      unchanged: 2,
    });
  });

  it("reads payload codes and conflict lists", () => {
    const payload = {
      code: "import_conflicts",
      conflicts: [
        { entity: "team", id: "t1", key: "slug", message: "team slug already exists" },
        { entity: "game", id: "g1", key: "id", message: "game already exists" },
        "ignored",
      ],
    };
    expect(importPayloadCode(payload)).toBe("import_conflicts");
    expect(importConflicts(payload)).toEqual([
      { entity: "team", id: "t1", key: "slug", message: "team slug already exists" },
      { entity: "game", id: "g1", key: "id", message: "game already exists" },
    ]);
    expect(importPayloadCode(null)).toBeNull();
    expect(importConflicts(null)).toEqual([]);
  });
});

describe("roster CSV parser", () => {
  it("parses quoted names, commas inside quotes and trailing commas", () => {
    const result = parseRosterCsv(
      'Ana,"García, Jr.",12,SS,\nLuis,Pérez,,\n\n  "Marta ""La Jefa""",Ruiz,7 , C \n',
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { firstName: "Ana", lastName: "García, Jr.", jersey: "12", primaryPosition: "SS" },
      { firstName: "Luis", lastName: "Pérez", jersey: "", primaryPosition: "" },
      { firstName: 'Marta "La Jefa"', lastName: "Ruiz", jersey: "7", primaryPosition: "C" },
    ]);
  });

  it("rejects duplicate first and last names regardless of case", () => {
    const result = parseRosterCsv("Ana,García,12,SS\nana,garcía,13,CF\nLuis,Pérez,,");
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([
      { line: 2, message: "Jugador repetido en el CSV: ana garcía." },
    ]);
  });

  it("rejects extra columns, missing names and unclosed quotes per line", () => {
    const result = parseRosterCsv('Ana,García,12,SS,extra\nSoloNombre\n"Ana,García,12,SS');
    expect(result.rows).toEqual([]);
    expect(result.errors.map((error) => error.line)).toEqual([1, 2, 3]);
    expect(result.errors[0]?.message).toContain("cuatro columnas");
    expect(result.errors[1]?.message).toContain("nombre");
    expect(result.errors[2]?.message).toContain("comillas");
  });

  it("builds the API payload without empty optional fields", () => {
    expect(
      rosterCsvPayload([
        { firstName: "Ana", lastName: "García", jersey: "12", primaryPosition: "SS" },
        { firstName: "Luis", lastName: "Pérez", jersey: "", primaryPosition: "" },
      ]),
    ).toEqual([
      { firstName: "Ana", lastName: "García", jersey: "12", primaryPosition: "SS" },
      { firstName: "Luis", lastName: "Pérez" },
    ]);
  });
});

describe("onboarding checklist", () => {
  const base = {
    seasons: 1,
    competitions: 1,
    teamSeasons: [
      { id: "ts1", rosterCount: 9 },
      { id: "ts2", rosterCount: 9 },
    ],
    games: 1,
    additionalUsers: 0,
  };

  it("marks required steps done and keeps the extra user as recommended", () => {
    const items = onboardingChecklist(base);
    expect(items.map((item) => item.id)).toEqual([
      "season",
      "competition",
      "teamSeasons",
      "rosters",
      "games",
      "users",
    ]);
    expect(onboardingReady(items)).toBe(true);
    expect(items.find((item) => item.id === "users")).toMatchObject({
      required: false,
      done: false,
    });
  });

  it("is not ready when a team season has no roster", () => {
    const items = onboardingChecklist({
      ...base,
      teamSeasons: [
        { id: "ts1", rosterCount: 9 },
        { id: "ts2", rosterCount: 0 },
      ],
    });
    expect(items.find((item) => item.id === "rosters")?.done).toBe(false);
    expect(onboardingReady(items)).toBe(false);
  });

  it("is not ready without two team seasons", () => {
    const items = onboardingChecklist({ ...base, teamSeasons: [{ id: "ts1", rosterCount: 9 }] });
    expect(items.find((item) => item.id === "teamSeasons")?.done).toBe(false);
    expect(onboardingReady(items)).toBe(false);
  });
});

describe("export filename and size", () => {
  it("uses the Content-Disposition filename", () => {
    expect(exportFileName('attachment; filename="liga-demo-league.json"', "otra")).toBe(
      "liga-demo-league.json",
    );
    expect(
      exportFileName("attachment; filename*=UTF-8''liga%20demo-league.json", "otra"),
    ).toBe("liga demo-league.json");
  });

  it("falls back to the organization slug", () => {
    expect(exportFileName(null, "liga-demo")).toBe("liga-demo-league.json");
    expect(exportFileName("attachment", "liga-demo")).toBe("liga-demo-league.json");
    expect(exportFileName(null, null)).toBe("league-league.json");
    expect(exportFileName('attachment; filename="../evil.json"', "liga-demo")).toBe(
      "evil.json",
    );
  });

  it("formats bytes with Spanish units", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1,5 kB");
    expect(formatFileSize(1048576)).toBe("1,0 MB");
  });
});

describe("error mapping", () => {
  it("maps export failures", () => {
    expect(exportLeagueErrorMessage(0)).toContain("conectar");
    expect(exportLeagueErrorMessage(401)).toContain("sesión");
    expect(exportLeagueErrorMessage(403)).toContain("permiso");
    expect(exportLeagueErrorMessage(500)).toContain("500");
  });

  it("maps import failures including organization mismatch", () => {
    const context = { organizationSlug: "liga-demo", bundleSlug: "otra-liga" };
    expect(
      importLeagueErrorMessage(
        { status: 409, code: "organization_mismatch", detail: "bundle organization" },
        context,
      ),
    ).toContain("otra-liga");
    expect(
      importLeagueErrorMessage(
        { status: 409, code: "import_conflicts", detail: "import conflicts" },
        context,
      ),
    ).toContain("conflictos");
    expect(
      importLeagueErrorMessage({ status: 400, code: null, detail: null }, context),
    ).toContain("no es válido");
    expect(
      importLeagueErrorMessage({ status: 401, code: null, detail: null }, context),
    ).toContain("sesión");
    expect(
      importLeagueErrorMessage({ status: 403, code: null, detail: null }, context),
    ).toContain("permiso");
    expect(
      importLeagueErrorMessage({ status: 0, code: null, detail: null }, context),
    ).toContain("conectar");
  });

  it("maps roster CSV failures", () => {
    expect(rosterImportErrorMessage(400, "duplicate roster row for Ana García")).toContain(
      "repetidos",
    );
    expect(rosterImportErrorMessage(400, "bad field")).toContain("no es válido");
    expect(rosterImportErrorMessage(401)).toContain("sesión");
    expect(rosterImportErrorMessage(403)).toContain("permiso");
    expect(rosterImportErrorMessage(404)).toContain("inscripción");
    expect(rosterImportErrorMessage(409)).toContain("roster cambió");
    expect(rosterImportErrorMessage(0)).toContain("conectar");
  });
});

describe("exportLeague", () => {
  it("downloads the bundle with its file name and byte size", async () => {
    const bundle = sampleBundle();
    const fetchMock = mockFetch(
      () =>
        new Response(JSON.stringify(bundle), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="liga-demo-league.json"',
          },
        }),
    );

    const result = await exportLeague(TOKEN, "season-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/export?seasonId=season-1");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(result.fileName).toBe("liga-demo-league.json");
    expect(result.bundle.organization.slug).toBe("liga-demo");
    expect(result.bytes).toBe(new TextEncoder().encode(JSON.stringify(bundle)).length);
  });

  it("omits seasonId when exporting every season", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, sampleBundle()));
    const result = await exportLeague(TOKEN, null);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/export");
    expect(result.fileName).toBe("liga-demo-league.json");
  });

  it("keeps the API status and payload on failure", async () => {
    mockFetch(() => jsonResponse(403, { message: "forbidden" }));
    await expect(exportLeague(TOKEN, null)).rejects.toMatchObject({
      status: 403,
      detail: "forbidden",
    });
  });

  it("maps a network failure to status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(exportLeague(TOKEN, null)).rejects.toMatchObject({ status: 0 });
  });
});

describe("importLeague", () => {
  it("sends the bundle directly as the dry-run body", async () => {
    const bundle = sampleBundle();
    const fetchMock = mockFetch(() => jsonResponse(200, sampleImportResult(true)));

    const result = await importLeague(TOKEN, bundle, true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/import?dryRun=true");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(bundle);
    expect(result.dryRun).toBe(true);
  });

  it("accepts 201 when applying", async () => {
    mockFetch(() => jsonResponse(201, sampleImportResult(false)));
    const result = await importLeague(TOKEN, sampleBundle(), false);
    expect(result.dryRun).toBe(false);
  });

  it("exposes 409 organization_mismatch codes", async () => {
    mockFetch(() =>
      jsonResponse(409, {
        statusCode: 409,
        code: "organization_mismatch",
        message: "bundle organization liga-otra does not match liga-demo",
      }),
    );
    try {
      await importLeague(TOKEN, sampleBundle(), false);
      throw new Error("expected import to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminApiError);
      const apiError = error as AdminApiError;
      expect(apiError.status).toBe(409);
      expect(importPayloadCode(apiError.payload)).toBe("organization_mismatch");
      expect(apiError.detail).toContain("does not match");
    }
  });

  it("exposes the conflict list on 409", async () => {
    const conflicts = [
      { entity: "team", id: "t1", key: "slug", message: "team slug already exists" },
    ];
    mockFetch(() =>
      jsonResponse(409, {
        statusCode: 409,
        code: "import_conflicts",
        message: "import conflicts",
        conflicts,
      }),
    );
    try {
      await importLeague(TOKEN, sampleBundle(), false);
      throw new Error("expected import to fail");
    } catch (error) {
      const apiError = error as AdminApiError;
      expect(importPayloadCode(apiError.payload)).toBe("import_conflicts");
      expect(importConflicts(apiError.payload)).toEqual(conflicts);
    }
  });

  it.each([400, 401, 403])("maps status %i", async (status) => {
    mockFetch(() => jsonResponse(status, { message: "nope" }));
    await expect(importLeague(TOKEN, sampleBundle(), false)).rejects.toMatchObject({ status });
  });

  it("maps a network failure to status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(importLeague(TOKEN, sampleBundle(), false)).rejects.toMatchObject({ status: 0 });
  });
});

describe("importRoster", () => {
  const rows = [{ firstName: "Ana", lastName: "García", jersey: "12", primaryPosition: "SS" }];

  const rosterResult = {
    dryRun: true,
    created: { players: 1, rosterEntries: 1 },
    updated: { rosterEntries: 0 },
    unchanged: 0,
    rows: [
      {
        ...rows[0],
        jersey: "12",
        primaryPosition: "SS",
        action: "create_player" as const,
        playerId: "player-1",
        rosterEntryId: "roster-1",
      },
    ],
  };

  it("posts rows and dryRun to the team season endpoint", async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, rosterResult));
    const result = await importRoster(TOKEN, TEAM_SEASON_ID, rows, true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:3001/admin/team-seasons/${TEAM_SEASON_ID}/roster-import`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ rows, dryRun: true });
    expect(result.rows[0]?.action).toBe("create_player");
  });

  it("accepts 201 when applying", async () => {
    mockFetch(() => jsonResponse(201, { ...rosterResult, dryRun: false }));
    const result = await importRoster(TOKEN, TEAM_SEASON_ID, rows, false);
    expect(result.dryRun).toBe(false);
  });

  it.each([400, 401, 403, 404, 409])("maps status %i", async (status) => {
    mockFetch(() => jsonResponse(status, { message: "nope" }));
    await expect(importRoster(TOKEN, TEAM_SEASON_ID, rows, true)).rejects.toMatchObject({
      status,
    });
  });

  it("keeps the duplicate detail on 400", async () => {
    mockFetch(() =>
      jsonResponse(400, { message: "duplicate roster row for Ana García" }),
    );
    await expect(importRoster(TOKEN, TEAM_SEASON_ID, rows, true)).rejects.toMatchObject({
      status: 400,
      detail: "duplicate roster row for Ana García",
    });
  });

  it("maps a network failure to status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(importRoster(TOKEN, TEAM_SEASON_ID, rows, true)).rejects.toMatchObject({
      status: 0,
    });
  });
});
