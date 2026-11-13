/**
 * Pure helpers for the league transfer panel, the roster CSV paste and the
 * onboarding checklist. No browser or network access: everything here is
 * testable in node.
 */

export const LEAGUE_BUNDLE_FORMAT = "olb.league/1";
export const ONBOARDING_DISMISSED_KEY = "olb.admin.onboarding.dismissed";

export interface LeagueBundlePlayer {
  id: string;
  firstName: string;
  lastName: string;
}

export interface LeagueBundleRosterEntry {
  id: string;
  player: LeagueBundlePlayer;
  jersey: string | null;
  primaryPosition: string | null;
  eligibilityStart: string | null;
  eligibilityEnd: string | null;
  status: "active" | "inactive";
}

export interface LeagueBundleCompetition {
  id: string;
  name: string;
  kind: "league" | "division";
  parentId: string | null;
  level: number;
  sortOrder: number;
}

export interface LeagueBundleSeason {
  id: string;
  year: number;
  name: string;
  status: "active" | "archived";
  startsOn: string | null;
  endsOn: string | null;
  competitions: LeagueBundleCompetition[];
}

export interface LeagueBundleTeam {
  id: string;
  name: string;
  slug: string;
  abbreviation: string | null;
}

export interface LeagueBundleTeamSeason {
  id: string;
  teamId: string;
  seasonId: string;
  competitionId: string | null;
  name: string | null;
  abbreviation: string | null;
  roster: LeagueBundleRosterEntry[];
}

export interface LeagueBundleGame {
  id: string;
  seasonId: string;
  competitionId: string;
  homeTeamSeasonId: string;
  awayTeamSeasonId: string;
  scheduledStart: string | null;
  venue: string | null;
  coverage: string;
  dataSource: string;
  rulesProfile: unknown | null;
}

export interface LeagueBundleOrganization {
  slug: string;
  name: string;
}

export interface LeagueBundle {
  format: string;
  exportedAt: string;
  organization: LeagueBundleOrganization;
  seasons: LeagueBundleSeason[];
  teams: LeagueBundleTeam[];
  teamSeasons: LeagueBundleTeamSeason[];
  games: LeagueBundleGame[];
}

export interface LeagueBundleSummary {
  seasons: number;
  competitions: number;
  teams: number;
  teamSeasons: number;
  players: number;
  rosterEntries: number;
  games: number;
}

export interface LeagueBundleMetadata {
  format: string;
  organizationSlug: string;
  organizationName: string;
  exportedAt: string;
  summary: LeagueBundleSummary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOf(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function playerKey(entry: Record<string, unknown>): string {
  const player = entry.player;
  if (isRecord(player)) {
    const id = stringOf(player.id);
    if (id.length > 0) return `id:${id}`;
    return `name:${stringOf(player.firstName).toLowerCase()}\u0000${stringOf(player.lastName).toLowerCase()}`;
  }
  return "";
}

/** Counts every entity in a bundle. Tolerates malformed input. */
export function summarizeBundle(bundle: unknown): LeagueBundleSummary {
  const root = isRecord(bundle) ? bundle : {};
  const seasons = arrayOf(root.seasons);
  const teamSeasons = arrayOf(root.teamSeasons);
  const players = new Set<string>();
  let competitions = 0;
  let rosterEntries = 0;

  for (const season of seasons) {
    if (isRecord(season)) competitions += arrayOf(season.competitions).length;
  }

  for (const teamSeason of teamSeasons) {
    if (!isRecord(teamSeason)) continue;
    for (const entry of arrayOf(teamSeason.roster)) {
      if (!isRecord(entry)) continue;
      rosterEntries += 1;
      const key = playerKey(entry);
      if (key.length > 0) players.add(key);
    }
  }

  return {
    seasons: seasons.length,
    competitions,
    teams: arrayOf(root.teams).length,
    teamSeasons: teamSeasons.length,
    players: players.size,
    rosterEntries,
    games: arrayOf(root.games).length,
  };
}

export function leagueBundleMetadata(bundle: unknown): LeagueBundleMetadata {
  const root = isRecord(bundle) ? bundle : {};
  const organization = isRecord(root.organization) ? root.organization : {};
  return {
    format: stringOf(root.format),
    organizationSlug: stringOf(organization.slug),
    organizationName: stringOf(organization.name),
    exportedAt: stringOf(root.exportedAt),
    summary: summarizeBundle(bundle),
  };
}

export interface LeagueBundleParseResult {
  bundle: LeagueBundle | null;
  error: string | null;
}

/** Validates enough of the bundle to show its metadata before sending it. */
export function parseLeagueBundleText(text: string): LeagueBundleParseResult {
  if (text.trim().length === 0) {
    return { bundle: null, error: "El archivo está vacío." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return { bundle: null, error: "El archivo no es un JSON válido." };
  }

  if (!isRecord(payload)) {
    return { bundle: null, error: "El archivo no contiene un paquete de liga." };
  }

  const format = stringOf(payload.format);
  if (format !== LEAGUE_BUNDLE_FORMAT) {
    return {
      bundle: null,
      error: `El archivo no es un paquete de liga OLB (se esperaba ${LEAGUE_BUNDLE_FORMAT}).`,
    };
  }

  const organization = isRecord(payload.organization) ? payload.organization : {};
  const slug = stringOf(organization.slug);
  if (slug.length === 0) {
    return {
      bundle: null,
      error: "El paquete no indica la organización de origen.",
    };
  }

  return { bundle: payload as unknown as LeagueBundle, error: null };
}

/** Human readable file size using Spanish decimal comma. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes < 10 ? 1 : 0).replace(".", ",")} kB`;
  }
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/**
 * File name from `Content-Disposition`, falling back to
 * `<organization-slug>-league.json`. Strips any directory component.
 */
export function exportFileName(
  contentDisposition: string | null | undefined,
  organizationSlug: string | null | undefined,
): string {
  const fallbackSlug = (organizationSlug ?? "").trim() || "league";
  const fallback = `${fallbackSlug}-league.json`;
  if (!contentDisposition) return fallback;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(contentDisposition);
  let candidate: string | null = null;
  if (encoded?.[1]) {
    try {
      candidate = decodeURIComponent(encoded[1].trim());
    } catch {
      candidate = encoded[1].trim();
    }
  } else {
    const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(contentDisposition);
    candidate = (plain?.[1] ?? plain?.[2] ?? "").trim();
  }

  candidate = (candidate ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
  candidate = candidate.replace(/^\.+/, "").trim();
  return candidate.length > 0 ? candidate : fallback;
}

export interface LeagueImportCounts {
  seasons: number;
  competitions: number;
  teams: number;
  teamSeasons: number;
  players: number;
  rosterEntries: number;
  games: number;
}

export interface LeagueImportConflict {
  entity: string;
  id: string;
  key: string;
  message: string;
}

export interface LeagueImportResult {
  dryRun: boolean;
  created: LeagueImportCounts;
  updated: LeagueImportCounts;
  unchanged: LeagueImportCounts;
  conflicts: LeagueImportConflict[];
  warnings: string[];
}

export const IMPORT_COUNT_KEYS = [
  "seasons",
  "competitions",
  "teams",
  "teamSeasons",
  "players",
  "rosterEntries",
  "games",
] as const;

export type ImportCountKey = (typeof IMPORT_COUNT_KEYS)[number];

export const IMPORT_COUNT_LABELS: Record<ImportCountKey, string> = {
  seasons: "Temporadas",
  competitions: "Competencias",
  teams: "Equipos",
  teamSeasons: "Inscripciones",
  players: "Jugadores",
  rosterEntries: "Entradas de roster",
  games: "Juegos",
};

export interface ImportDiffRow {
  key: ImportCountKey;
  label: string;
  created: number;
  updated: number;
  unchanged: number;
}

export function importDiffRows(result: LeagueImportResult): ImportDiffRow[] {
  return IMPORT_COUNT_KEYS.map((key) => ({
    key,
    label: IMPORT_COUNT_LABELS[key],
    created: result.created[key],
    updated: result.updated[key],
    unchanged: result.unchanged[key],
  }));
}

export interface BundleSummaryRow {
  key: ImportCountKey;
  label: string;
  value: number;
}

export function bundleSummaryRows(summary: LeagueBundleSummary): BundleSummaryRow[] {
  return IMPORT_COUNT_KEYS.map((key) => ({
    key,
    label: IMPORT_COUNT_LABELS[key],
    value: summary[key],
  }));
}

export function importPayloadCode(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return typeof payload.code === "string" ? payload.code : null;
}

export function importConflicts(payload: unknown): LeagueImportConflict[] {
  if (!isRecord(payload) || !Array.isArray(payload.conflicts)) return [];
  const conflicts: LeagueImportConflict[] = [];
  for (const raw of payload.conflicts) {
    if (!isRecord(raw)) continue;
    conflicts.push({
      entity: stringOf(raw.entity),
      id: stringOf(raw.id),
      key: stringOf(raw.key),
      message: stringOf(raw.message),
    });
  }
  return conflicts;
}

export function exportLeagueErrorMessage(status: number): string {
  switch (status) {
    case 0:
      return "No se pudo conectar con la API. Comprueba que esté en marcha.";
    case 400:
      return "No se pudo exportar: selecciona una temporada o revisa la organización.";
    case 401:
      return "La sesión no es válida o ha caducado. Vuelve a iniciar sesión.";
    case 403:
      return "No tienes permiso para exportar esta liga.";
    case 404:
      return "La temporada seleccionada ya no existe. Actualiza la lista.";
    default:
      return `No se pudo exportar la liga (error ${status}).`;
  }
}

export interface LeagueImportErrorInput {
  status: number;
  code: string | null;
  detail: string | null;
}

export interface LeagueImportErrorContext {
  organizationSlug: string;
  bundleSlug: string | null;
}

export function importLeagueErrorMessage(
  input: LeagueImportErrorInput,
  context: LeagueImportErrorContext,
): string {
  if (input.code === "organization_mismatch") {
    const bundleSlug = context.bundleSlug ?? "otra organización";
    return `El paquete pertenece a «${bundleSlug}» y esta consola opera «${context.organizationSlug}». Exporta la liga desde la organización correcta.`;
  }
  if (input.code === "import_conflicts" || (input.status === 409 && input.detail === "import conflicts")) {
    return "La API detectó conflictos al importar. Revisa la lista y vuelve a previsualizar.";
  }

  switch (input.status) {
    case 0:
      return "No se pudo conectar con la API. Comprueba que esté en marcha.";
    case 400:
      return "El paquete no es válido: revisa el formato, las referencias y los identificadores duplicados.";
    case 401:
      return "La sesión no es válida o ha caducado. Vuelve a iniciar sesión.";
    case 403:
      return "No tienes permiso para importar en esta organización.";
    case 404:
      return "Alguna referencia del paquete ya no existe. Exporta la liga de nuevo.";
    case 409:
      return "La importación entra en conflicto con los datos actuales.";
    default:
      return `No se pudo importar la liga (error ${input.status}).`;
  }
}

export interface RosterImportRowPayload {
  firstName: string;
  lastName: string;
  jersey?: string;
  primaryPosition?: string;
}

export type RosterImportAction =
  | "create_player"
  | "create_roster_entry"
  | "update_roster_entry"
  | "unchanged";

export interface RosterImportRowResult extends RosterImportRowPayload {
  action: RosterImportAction;
  playerId: string | null;
  rosterEntryId: string | null;
}

export interface RosterImportResult {
  dryRun: boolean;
  created: { players: number; rosterEntries: number };
  updated: { rosterEntries: number };
  unchanged: number;
  rows: RosterImportRowResult[];
}

export const ROSTER_ACTION_LABELS: Record<RosterImportAction, string> = {
  create_player: "Alta de jugador",
  create_roster_entry: "Alta en roster",
  update_roster_entry: "Actualización",
  unchanged: "Sin cambios",
};

export function rosterImportErrorMessage(status: number, detail: string | null = null): string {
  if (status === 400) {
    if (detail?.toLowerCase().includes("duplicate roster row")) {
      return "Hay jugadores repetidos en el CSV. Cada nombre y apellido debe aparecer una sola vez.";
    }
    return "El CSV no es válido: revisa nombres, dorsales y posiciones.";
  }
  switch (status) {
    case 0:
      return "No se pudo conectar con la API. Comprueba que esté en marcha.";
    case 401:
      return "La sesión no es válida o ha caducado. Vuelve a iniciar sesión.";
    case 403:
      return "No tienes permiso para editar el roster de esta inscripción.";
    case 404:
      return "La inscripción del equipo ya no existe. Actualiza las listas.";
    case 409:
      return "El roster cambió mientras editabas. Actualiza y vuelve a intentarlo.";
    default:
      return `No se pudo importar el roster (error ${status}).`;
  }
}

// ---------------------------------------------------------------------------
// Roster CSV

export interface RosterCsvRow {
  firstName: string;
  lastName: string;
  jersey: string;
  primaryPosition: string;
}

export interface RosterCsvError {
  line: number;
  message: string;
}

export interface RosterCsvParseResult {
  rows: RosterCsvRow[];
  errors: RosterCsvError[];
}

interface ParsedLine {
  cells: string[];
  quotedError: boolean;
}

function parseCsvLine(line: string): ParsedLine {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  let quotedError = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (quoted) quotedError = true;
  cells.push(current);

  return { cells: cells.map((cell) => cell.trim()), quotedError };
}

/**
 * Parses one player per line: `firstName,lastName,jersey,position`.
 * Quotes are supported, extra empty trailing columns are ignored, jersey and
 * position may be empty, and repeated first+last names are rejected.
 */
export function parseRosterCsv(text: string): RosterCsvParseResult {
  const rows: RosterCsvRow[] = [];
  const errors: RosterCsvError[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const lineNumber = index + 1;
    if (rawLine.trim().length === 0) continue;

    const { cells, quotedError } = parseCsvLine(rawLine);
    if (quotedError) {
      errors.push({ line: lineNumber, message: "Hay comillas sin cerrar." });
      continue;
    }

    if (cells.slice(4).some((cell) => cell.length > 0)) {
      errors.push({ line: lineNumber, message: "Hay más de cuatro columnas." });
      continue;
    }

    const firstName = cells[0] ?? "";
    const lastName = cells[1] ?? "";
    const jersey = cells[2] ?? "";
    const primaryPosition = cells[3] ?? "";

    if (firstName.length === 0 || lastName.length === 0) {
      errors.push({ line: lineNumber, message: "Faltan el nombre o el apellido." });
      continue;
    }

    const key = `${firstName.toLowerCase()}\u0000${lastName.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push({
        line: lineNumber,
        message: `Jugador repetido en el CSV: ${firstName} ${lastName}.`,
      });
      continue;
    }
    seen.add(key);

    rows.push({ firstName, lastName, jersey, primaryPosition });
  }

  return { rows, errors };
}

export function rosterCsvPayload(rows: RosterCsvRow[]): RosterImportRowPayload[] {
  return rows.map((row) => {
    const payload: RosterImportRowPayload = {
      firstName: row.firstName,
      lastName: row.lastName,
    };
    if (row.jersey.length > 0) payload.jersey = row.jersey;
    if (row.primaryPosition.length > 0) payload.primaryPosition = row.primaryPosition;
    return payload;
  });
}

// ---------------------------------------------------------------------------
// Onboarding checklist

export interface OnboardingTeamSeason {
  id: string;
  rosterCount: number;
}

export interface OnboardingData {
  seasons: number;
  competitions: number;
  teamSeasons: OnboardingTeamSeason[];
  games: number;
  additionalUsers: number;
}

export interface OnboardingItem {
  id: "season" | "competition" | "teamSeasons" | "rosters" | "games" | "users";
  label: string;
  detail: string;
  done: boolean;
  required: boolean;
  href: string;
}

export function onboardingChecklist(data: OnboardingData): OnboardingItem[] {
  const hasTeamSeasons = data.teamSeasons.length > 0;
  return [
    {
      id: "season",
      label: "Temporada creada",
      detail: "Crea la temporada y marca su estado.",
      done: data.seasons > 0,
      required: true,
      href: "#form-season",
    },
    {
      id: "competition",
      label: "Competencia creada",
      detail: "Añade al menos una competencia a la temporada.",
      done: data.competitions > 0,
      required: true,
      href: "#form-competition",
    },
    {
      id: "teamSeasons",
      label: "Al menos dos equipos inscritos",
      detail: "Inscribe dos equipos en la competencia.",
      done: data.teamSeasons.length >= 2,
      required: true,
      href: "#form-team-season",
    },
    {
      id: "rosters",
      label: "Cada equipo inscrito tiene roster",
      detail: "Añade jugadores a cada inscripción.",
      done: hasTeamSeasons && data.teamSeasons.every((teamSeason) => teamSeason.rosterCount > 0),
      required: true,
      href: "#list-roster",
    },
    {
      id: "games",
      label: "Al menos un juego programado",
      detail: "Programa el primer juego de la temporada.",
      done: data.games > 0,
      required: true,
      href: "#list-games",
    },
    {
      id: "users",
      label: "Al menos un usuario además del admin",
      detail: "Recomendado: invita a otra persona para operar la liga.",
      done: data.additionalUsers > 0,
      required: false,
      href: "/admin/users",
    },
  ];
}

export function onboardingReady(items: OnboardingItem[]): boolean {
  return items.filter((item) => item.required).every((item) => item.done);
}
