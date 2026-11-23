"use client";

import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import {
  competitionUpdatePayload,
  playerDeleteNeedsForce,
  playerUpdatePayload,
  rosterUpdatePayload,
  seasonUpdatePayload,
  teamSeasonUpdatePayload,
  teamUpdatePayload,
  type AdminPlayer,
  type AdminTeam,
} from "@/lib/admin";
import {
  AdminApiError,
  deleteCompetition,
  deletePlayer,
  deleteRosterEntry,
  deleteSeason,
  deleteTeam,
  deleteTeamSeason,
  grantNameConsent,
  importRoster,
  revokeNameConsent,
  updateCompetition,
  updatePlayer,
  updateRosterEntry,
  updateSeason,
  updateTeam,
  updateTeamSeason,
} from "@/lib/admin-api";
import {
  parseRosterCsv,
  rosterCsvPayload,
  rosterImportErrorMessage,
  ROSTER_ACTION_LABELS,
  type RosterImportResult,
  type RosterCsvParseResult,
} from "@/lib/admin-transfer";
import type {
  LeagueCompetition,
  LeagueRosterEntry,
  LeagueSeason,
  LeagueTeamSeason,
} from "@/lib/types";

type Message = { kind: "ok" | "error"; text: string } | null;

const INPUT =
  "min-h-10 w-full border border-line-strong bg-raised px-2 font-body text-body-sm text-ink outline-none transition-colors focus:border-band disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-ink-muted";
const LABEL = "font-label-caps text-label-caps uppercase text-ink-muted";
const SMALL_BUTTON =
  "inline-flex min-h-9 items-center justify-center border border-line-strong px-3 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-band disabled:cursor-not-allowed disabled:opacity-60";
const SMALL_DANGER =
  "inline-flex min-h-9 items-center justify-center border border-line-strong px-3 font-label-caps text-label-caps uppercase text-accent transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const CELL = "border-b border-line px-2 py-2 align-top font-body text-body-sm text-ink";
const HEAD = "border-b border-line-strong px-2 py-2 text-left font-label-caps text-label-caps uppercase text-ink-muted";

function errorText(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Error inesperado. Inténtalo de nuevo.";
}

function formatDate(value: string | null): string {
  return value ?? "—";
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FormMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={
        message.kind === "ok"
          ? "border-l-4 border-band bg-surface-low px-3 py-2 font-body text-body-sm text-ink"
          : "border-l-4 border-accent bg-accent-soft px-3 py-2 font-body text-body-sm text-ink"
      }
    >
      {message.text}
    </p>
  );
}

function Editor({
  onSubmit,
  onCancel,
  pending,
  children,
  submitLabel = "Guardar cambios",
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
  children: ReactNode;
  submitLabel?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 py-2">
      {children}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={SMALL_BUTTON}>
          {pending ? "Guardando…" : submitLabel}
        </button>
        <button type="button" disabled={pending} className={SMALL_BUTTON} onClick={onCancel}>
          Descartar
        </button>
      </div>
    </form>
  );
}

function Confirm({
  text,
  pending,
  label,
  onConfirm,
  onCancel,
}: {
  text: string;
  pending: boolean;
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alert" className="border-l-4 border-accent bg-accent-soft px-3 py-2">
      <p className="font-body text-body-sm text-ink">{text}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={SMALL_DANGER} onClick={onConfirm}>
          {pending ? "Borrando…" : label}
        </button>
        <button type="button" disabled={pending} className={SMALL_BUTTON} onClick={onCancel}>
          No
        </button>
      </div>
    </div>
  );
}

function CatalogCard({
  testId,
  title,
  description,
  message,
  children,
}: {
  testId: string;
  title: string;
  description: string;
  message: Message;
  children: ReactNode;
}) {
  return (
    <section
      id={testId}
      data-testid={testId}
      className="border border-line-strong bg-raised p-5 md:p-6"
    >
      <h2 className="font-display text-headline-sm uppercase text-ink">{title}</h2>
      <p className="mt-1 font-body text-body-sm text-ink-muted">{description}</p>
      {message ? (
        <div className="mt-4">
          <FormMessage message={message} />
        </div>
      ) : null}
      {children}
    </section>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seasons

export function SeasonCatalog({
  token,
  seasons,
  onChanged,
}: {
  token: string;
  seasons: LeagueSeason[];
  onChanged: () => Promise<void> | void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  function beginEdit(season: LeagueSeason) {
    setMessage(null);
    setConfirmingId(null);
    setEditingId(season.id);
    setName(season.name);
    setYear(String(season.year));
    setStatus(season.status);
    setStartsOn(season.startsOn ?? "");
    setEndsOn(season.endsOn ?? "");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, season: LeagueSeason) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const updated = await updateSeason(
        token,
        season.id,
        seasonUpdatePayload({ name, year, status, startsOn, endsOn }),
      );
      setEditingId(null);
      setMessage({ kind: "ok", text: `Temporada ${updated.year} actualizada.` });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(season: LeagueSeason) {
    setPending(true);
    setMessage(null);
    try {
      await deleteSeason(token, season.id);
      setConfirmingId(null);
      setMessage({ kind: "ok", text: `Temporada ${season.year} eliminada.` });
      await onChanged();
    } catch (error) {
      setConfirmingId(null);
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <CatalogCard
      testId="list-seasons"
      title="Temporadas"
      description="Edita o borra temporadas. Solo se borra una temporada vacía."
      message={message}
    >
      {seasons.length === 0 ? (
        <p className="mt-4 font-body text-body-sm text-ink-muted">
          Aún no hay temporadas. Crea la primera arriba.
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={HEAD}>Nombre</th>
              <th className={HEAD}>Año</th>
              <th className={HEAD}>Estado</th>
              <th className={HEAD}>Fechas</th>
              <th className={HEAD}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <Fragment key={season.id}>
                <tr>
                  <td className={CELL}>{season.name}</td>
                  <td className={CELL}>{season.year}</td>
                  <td className={CELL}>{season.status === "active" ? "Activa" : "Archivada"}</td>
                  <td className={CELL}>
                    {formatDate(season.startsOn)} — {formatDate(season.endsOn)}
                  </td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => beginEdit(season)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={SMALL_DANGER}
                        onClick={() => {
                          setMessage(null);
                          setEditingId(null);
                          setConfirmingId(season.id);
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === season.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-line px-2 pb-3">
                      <Editor
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(event) => handleSave(event, season)}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Nombre" htmlFor={`season-${season.id}-name`}>
                            <input
                              id={`season-${season.id}-name`}
                              required
                              maxLength={120}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Año" htmlFor={`season-${season.id}-year`}>
                            <input
                              id={`season-${season.id}-year`}
                              type="number"
                              min={1900}
                              max={9999}
                              required
                              value={year}
                              onChange={(event) => setYear(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Estado" htmlFor={`season-${season.id}-status`}>
                            <select
                              id={`season-${season.id}-status`}
                              value={status}
                              onChange={(event) =>
                                setStatus(event.target.value === "archived" ? "archived" : "active")
                              }
                              className={INPUT}
                            >
                              <option value="active">Activa</option>
                              <option value="archived">Archivada</option>
                            </select>
                          </Field>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Inicio" htmlFor={`season-${season.id}-start`}>
                              <input
                                id={`season-${season.id}-start`}
                                type="date"
                                value={startsOn}
                                onChange={(event) => setStartsOn(event.target.value)}
                                className={INPUT}
                              />
                            </Field>
                            <Field label="Fin" htmlFor={`season-${season.id}-end`}>
                              <input
                                id={`season-${season.id}-end`}
                                type="date"
                                value={endsOn}
                                onChange={(event) => setEndsOn(event.target.value)}
                                className={INPUT}
                              />
                            </Field>
                          </div>
                        </div>
                        <p className="font-body text-body-sm text-ink-muted">
                          Marcar una temporada como activa archiva las demás.
                        </p>
                      </Editor>
                    </td>
                  </tr>
                ) : null}
                {confirmingId === season.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-line px-2 pb-3">
                      <Confirm
                        text={`¿Borrar la temporada “${season.name}”? Solo es posible si no tiene competencias, inscripciones ni juegos.`}
                        pending={pending}
                        label="Sí, borrar temporada"
                        onConfirm={() => void handleDelete(season)}
                        onCancel={() => setConfirmingId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </TableWrap>
      )}
    </CatalogCard>
  );
}

// ---------------------------------------------------------------------------
// Competitions

export function CompetitionCatalog({
  token,
  competitions,
  onChanged,
}: {
  token: string;
  competitions: LeagueCompetition[];
  onChanged: () => Promise<void> | void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"league" | "division">("league");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  function beginEdit(competition: LeagueCompetition) {
    setMessage(null);
    setConfirmingId(null);
    setEditingId(competition.id);
    setName(competition.name);
    setKind(competition.kind);
    setParentId(competition.parentId ?? "");
    setSortOrder(String(competition.sortOrder));
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
    competition: LeagueCompetition,
  ) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const updated = await updateCompetition(
        token,
        competition.id,
        competitionUpdatePayload({ name, kind, parentId, sortOrder }),
      );
      setEditingId(null);
      setMessage({ kind: "ok", text: `Competencia “${updated.name}” actualizada.` });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(competition: LeagueCompetition) {
    setPending(true);
    setMessage(null);
    try {
      await deleteCompetition(token, competition.id);
      setConfirmingId(null);
      setMessage({ kind: "ok", text: `Competencia “${competition.name}” eliminada.` });
      await onChanged();
    } catch (error) {
      setConfirmingId(null);
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  const nameById = new Map(competitions.map((row) => [row.id, row.name]));

  return (
    <CatalogCard
      testId="list-competitions"
      title="Competencias de la temporada"
      description="Edita el nombre, el tipo, la competencia padre y el orden. Solo se borra una competencia vacía."
      message={message}
    >
      {competitions.length === 0 ? (
        <p className="mt-4 font-body text-body-sm text-ink-muted">
          Aún no hay competencias en esta temporada. Crea la primera arriba.
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={HEAD}>Nombre</th>
              <th className={HEAD}>Tipo</th>
              <th className={HEAD}>Padre</th>
              <th className={HEAD}>Nivel / orden</th>
              <th className={HEAD}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {competitions.map((competition) => (
              <Fragment key={competition.id}>
                <tr>
                  <td className={CELL}>{competition.name}</td>
                  <td className={CELL}>
                    {competition.kind === "division" ? "División" : "Liga"}
                  </td>
                  <td className={CELL}>
                    {competition.parentId ? (nameById.get(competition.parentId) ?? "—") : "—"}
                  </td>
                  <td className={CELL}>
                    {competition.level} / {competition.sortOrder}
                  </td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => beginEdit(competition)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={SMALL_DANGER}
                        onClick={() => {
                          setMessage(null);
                          setEditingId(null);
                          setConfirmingId(competition.id);
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === competition.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-line px-2 pb-3">
                      <Editor
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(event) => handleSave(event, competition)}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Nombre" htmlFor={`competition-${competition.id}-name`}>
                            <input
                              id={`competition-${competition.id}-name`}
                              required
                              maxLength={120}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Tipo" htmlFor={`competition-${competition.id}-kind`}>
                            <select
                              id={`competition-${competition.id}-kind`}
                              value={kind}
                              onChange={(event) =>
                                setKind(event.target.value === "division" ? "division" : "league")
                              }
                              className={INPUT}
                            >
                              <option value="league">Liga</option>
                              <option value="division">División</option>
                            </select>
                          </Field>
                          <Field label="Competencia padre" htmlFor={`competition-${competition.id}-parent`}>
                            <select
                              id={`competition-${competition.id}-parent`}
                              value={parentId}
                              onChange={(event) => setParentId(event.target.value)}
                              className={INPUT}
                            >
                              <option value="">— Sin padre —</option>
                              {competitions
                                .filter((row) => row.id !== competition.id)
                                .map((row) => (
                                  <option key={row.id} value={row.id}>
                                    {row.name}
                                  </option>
                                ))}
                            </select>
                          </Field>
                          <Field label="Orden" htmlFor={`competition-${competition.id}-sort`}>
                            <input
                              id={`competition-${competition.id}-sort`}
                              type="number"
                              min={-10000}
                              max={10000}
                              required
                              value={sortOrder}
                              onChange={(event) => setSortOrder(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                        </div>
                        <p className="font-body text-body-sm text-ink-muted">
                          Nivel {competition.level}: la API actual solo permite cambiarlo al crear
                          la competencia.
                        </p>
                      </Editor>
                    </td>
                  </tr>
                ) : null}
                {confirmingId === competition.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-line px-2 pb-3">
                      <Confirm
                        text={`¿Borrar la competencia “${competition.name}”? Solo es posible si no tiene equipos inscritos ni juegos.`}
                        pending={pending}
                        label="Sí, borrar competencia"
                        onConfirm={() => void handleDelete(competition)}
                        onCancel={() => setConfirmingId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </TableWrap>
      )}
    </CatalogCard>
  );
}

// ---------------------------------------------------------------------------
// Teams

export function TeamCatalog({
  token,
  teams,
  onChanged,
}: {
  token: string;
  teams: AdminTeam[];
  onChanged: () => Promise<void> | void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [abbreviation, setAbbreviation] = useState("");

  function beginEdit(team: AdminTeam) {
    setMessage(null);
    setConfirmingId(null);
    setEditingId(team.id);
    setName(team.name);
    setSlug(team.slug);
    setAbbreviation(team.abbreviation ?? "");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, team: AdminTeam) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const updated = await updateTeam(
        token,
        team.id,
        teamUpdatePayload({ name, slug, abbreviation }),
      );
      setEditingId(null);
      setMessage({ kind: "ok", text: `Equipo “${updated.name}” actualizado.` });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(team: AdminTeam) {
    setPending(true);
    setMessage(null);
    try {
      await deleteTeam(token, team.id);
      setConfirmingId(null);
      setMessage({ kind: "ok", text: `Equipo “${team.name}” eliminado.` });
      await onChanged();
    } catch (error) {
      setConfirmingId(null);
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <CatalogCard
      testId="list-teams"
      title="Equipos de la organización"
      description="Edita el nombre, el slug y la abreviatura. Solo se borra un equipo sin inscripciones."
      message={message}
    >
      {teams.length === 0 ? (
        <p className="mt-4 font-body text-body-sm text-ink-muted">
          Aún no hay equipos. Crea el primero arriba.
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={HEAD}>Nombre</th>
              <th className={HEAD}>Slug</th>
              <th className={HEAD}>Abreviatura</th>
              <th className={HEAD}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <Fragment key={team.id}>
                <tr>
                  <td className={CELL}>{team.name}</td>
                  <td className={CELL}>{team.slug}</td>
                  <td className={CELL}>{team.abbreviation ?? "—"}</td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => beginEdit(team)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={SMALL_DANGER}
                        onClick={() => {
                          setMessage(null);
                          setEditingId(null);
                          setConfirmingId(team.id);
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === team.id ? (
                  <tr>
                    <td colSpan={4} className="border-b border-line px-2 pb-3">
                      <Editor
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(event) => handleSave(event, team)}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Field label="Nombre" htmlFor={`team-${team.id}-name`}>
                            <input
                              id={`team-${team.id}-name`}
                              required
                              maxLength={120}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Slug" htmlFor={`team-${team.id}-slug`}>
                            <input
                              id={`team-${team.id}-slug`}
                              required
                              maxLength={80}
                              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                              value={slug}
                              onChange={(event) => setSlug(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Abreviatura" htmlFor={`team-${team.id}-abbreviation`}>
                            <input
                              id={`team-${team.id}-abbreviation`}
                              maxLength={16}
                              value={abbreviation}
                              onChange={(event) => setAbbreviation(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                        </div>
                      </Editor>
                    </td>
                  </tr>
                ) : null}
                {confirmingId === team.id ? (
                  <tr>
                    <td colSpan={4} className="border-b border-line px-2 pb-3">
                      <Confirm
                        text={`¿Borrar el equipo “${team.name}”? Solo es posible si no tiene inscripciones en ninguna temporada.`}
                        pending={pending}
                        label="Sí, borrar equipo"
                        onConfirm={() => void handleDelete(team)}
                        onCancel={() => setConfirmingId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </TableWrap>
      )}
    </CatalogCard>
  );
}

// ---------------------------------------------------------------------------
// Team seasons

export function TeamSeasonCatalog({
  token,
  teamSeasons,
  competitions,
  onChanged,
}: {
  token: string;
  teamSeasons: LeagueTeamSeason[];
  competitions: LeagueCompetition[];
  onChanged: () => Promise<void> | void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [competitionId, setCompetitionId] = useState("");

  function beginEdit(teamSeason: LeagueTeamSeason) {
    setMessage(null);
    setConfirmingId(null);
    setEditingId(teamSeason.id);
    setName(teamSeason.name);
    setAbbreviation(teamSeason.abbreviation ?? "");
    setCompetitionId(teamSeason.competitionId ?? "");
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
    teamSeason: LeagueTeamSeason,
  ) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const updated = await updateTeamSeason(
        token,
        teamSeason.id,
        teamSeasonUpdatePayload({ name, abbreviation, competitionId }),
      );
      setEditingId(null);
      setMessage({ kind: "ok", text: `Inscripción “${updated.name}” actualizada.` });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(teamSeason: LeagueTeamSeason) {
    setPending(true);
    setMessage(null);
    try {
      await deleteTeamSeason(token, teamSeason.id);
      setConfirmingId(null);
      setMessage({ kind: "ok", text: `Inscripción “${teamSeason.name}” eliminada.` });
      await onChanged();
    } catch (error) {
      setConfirmingId(null);
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <CatalogCard
      testId="list-team-seasons"
      title="Inscripciones de la competencia"
      description="Edita el nombre y la abreviatura, mueve la inscripción de competencia o bórrala si no tiene juegos."
      message={message}
    >
      {teamSeasons.length === 0 ? (
        <p className="mt-4 font-body text-body-sm text-ink-muted">
          Aún no hay equipos inscritos en esta competencia. Inscribe uno arriba.
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={HEAD}>Nombre</th>
              <th className={HEAD}>Equipo</th>
              <th className={HEAD}>Competencia</th>
              <th className={HEAD}>Abreviatura</th>
              <th className={HEAD}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {teamSeasons.map((teamSeason) => (
              <Fragment key={teamSeason.id}>
                <tr>
                  <td className={CELL}>{teamSeason.name}</td>
                  <td className={CELL}>{teamSeason.teamName}</td>
                  <td className={CELL}>{teamSeason.competitionName ?? "—"}</td>
                  <td className={CELL}>{teamSeason.abbreviation ?? "—"}</td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => beginEdit(teamSeason)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={SMALL_DANGER}
                        onClick={() => {
                          setMessage(null);
                          setEditingId(null);
                          setConfirmingId(teamSeason.id);
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === teamSeason.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-line px-2 pb-3">
                      <Editor
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(event) => handleSave(event, teamSeason)}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <Field label="Nombre" htmlFor={`team-season-${teamSeason.id}-name`}>
                            <input
                              id={`team-season-${teamSeason.id}-name`}
                              required
                              maxLength={120}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field
                            label="Abreviatura"
                            htmlFor={`team-season-${teamSeason.id}-abbreviation`}
                          >
                            <input
                              id={`team-season-${teamSeason.id}-abbreviation`}
                              maxLength={16}
                              value={abbreviation}
                              onChange={(event) => setAbbreviation(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field
                            label="Competencia"
                            htmlFor={`team-season-${teamSeason.id}-competition`}
                          >
                            <select
                              id={`team-season-${teamSeason.id}-competition`}
                              value={competitionId}
                              onChange={(event) => setCompetitionId(event.target.value)}
                              className={INPUT}
                            >
                              <option value="">— Selecciona —</option>
                              {competitions.map((competition) => (
                                <option key={competition.id} value={competition.id}>
                                  {competition.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <p className="font-body text-body-sm text-ink-muted">
                          Mover una inscripción requiere permiso de administración sobre la
                          competencia de destino.
                        </p>
                      </Editor>
                    </td>
                  </tr>
                ) : null}
                {confirmingId === teamSeason.id ? (
                  <tr>
                    <td colSpan={5} className="border-b border-line px-2 pb-3">
                      <Confirm
                        text={`¿Borrar la inscripción “${teamSeason.name}”? Solo es posible si no tiene juegos asociados.`}
                        pending={pending}
                        label="Sí, borrar inscripción"
                        onConfirm={() => void handleDelete(teamSeason)}
                        onCancel={() => setConfirmingId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </TableWrap>
      )}
    </CatalogCard>
  );
}

// ---------------------------------------------------------------------------
// Players

export function PlayerCatalog({
  token,
  players,
  onChanged,
}: {
  token: string;
  players: AdminPlayer[];
  onChanged: () => Promise<void> | void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [force, setForce] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [consentForId, setConsentForId] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState("");

  function beginEdit(player: AdminPlayer) {
    setMessage(null);
    setConfirmingId(null);
    setConsentForId(null);
    setEditingId(player.id);
    setFirstName(player.firstName);
    setLastName(player.lastName);
  }

  function beginConsent(player: AdminPlayer) {
    setMessage(null);
    setEditingId(null);
    setConfirmingId(null);
    setConsentForId(player.id);
    setGuardianName("");
    setRelationship("");
  }

  async function handleGrantConsent(
    event: FormEvent<HTMLFormElement>,
    player: AdminPlayer,
  ) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await grantNameConsent(token, player.id, {
        guardianName: guardianName.trim(),
        relationship: relationship.trim() || null,
      });
      setConsentForId(null);
      setMessage({
        kind: "ok",
        text: `Nombre público autorizado para ${player.firstName} ${player.lastName}.`,
      });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleRevokeConsent(player: AdminPlayer) {
    setPending(true);
    setMessage(null);
    try {
      await revokeNameConsent(token, player.id);
      setMessage({
        kind: "ok",
        text: `Nombre público oculto para ${player.firstName} ${player.lastName}.`,
      });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, player: AdminPlayer) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const updated = await updatePlayer(
        token,
        player.id,
        playerUpdatePayload({ firstName, lastName }),
      );
      setEditingId(null);
      setMessage({
        kind: "ok",
        text: `Jugador ${updated.firstName} ${updated.lastName} actualizado.`,
      });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(player: AdminPlayer) {
    setPending(true);
    setMessage(null);
    try {
      const result = await deletePlayer(token, player.id, force);
      setConfirmingId(null);
      setForce(false);
      setMessage({
        kind: "ok",
        text:
          result.rosterEntriesDeleted > 0
            ? `Jugador ${player.firstName} ${player.lastName} eliminado con ${result.rosterEntriesDeleted} entrada(s) de roster.`
            : `Jugador ${player.firstName} ${player.lastName} eliminado.`,
      });
      await onChanged();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 409 && playerDeleteNeedsForce(error.detail)) {
        setForce(true);
        setMessage({
          kind: "error",
          text: "El jugador tiene entradas de roster. Confirma otra vez para borrarlo junto con ellas.",
        });
      } else {
        setConfirmingId(null);
        setForce(false);
        setMessage({ kind: "error", text: errorText(error) });
      }
    } finally {
      setPending(false);
    }
  }

  function beginDelete(player: AdminPlayer) {
    setMessage(null);
    setEditingId(null);
    setForce(false);
    setConfirmingId(player.id);
  }

  const confirmingPlayer = players.find((player) => player.id === confirmingId) ?? null;

  return (
    <CatalogCard
      testId="list-players"
      title="Jugadores de la organización"
      description="Edita el nombre, autoriza su publicación o borra el jugador. El nombre permanece oculto hasta que exista consentimiento del tutor."
      message={message}
    >
      {players.length === 0 ? (
        <p className="mt-4 font-body text-body-sm text-ink-muted">
          Aún no hay jugadores. Crea el primero arriba.
        </p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={HEAD}>Nombre</th>
              <th className={HEAD}>Apellido</th>
              <th className={HEAD}>Nombre público</th>
              <th className={HEAD}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <Fragment key={player.id}>
                <tr>
                  <td className={CELL}>{player.firstName}</td>
                  <td className={CELL}>{player.lastName}</td>
                  <td className={CELL}>{player.namePublic ? "Sí" : "No"}</td>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={SMALL_BUTTON}
                        onClick={() => beginEdit(player)}
                      >
                        Editar
                      </button>
                      {player.namePublic ? (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          disabled={pending}
                          onClick={() => void handleRevokeConsent(player)}
                        >
                          Ocultar nombre
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={SMALL_BUTTON}
                          onClick={() => beginConsent(player)}
                        >
                          Autorizar nombre
                        </button>
                      )}
                      <button
                        type="button"
                        className={SMALL_DANGER}
                        onClick={() => beginDelete(player)}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === player.id ? (
                  <tr>
                    <td colSpan={4} className="border-b border-line px-2 pb-3">
                      <Editor
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(event) => handleSave(event, player)}
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Nombre" htmlFor={`player-${player.id}-first`}>
                            <input
                              id={`player-${player.id}-first`}
                              required
                              maxLength={120}
                              value={firstName}
                              onChange={(event) => setFirstName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field label="Apellido" htmlFor={`player-${player.id}-last`}>
                            <input
                              id={`player-${player.id}-last`}
                              required
                              maxLength={120}
                              value={lastName}
                              onChange={(event) => setLastName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                        </div>
                      </Editor>
                    </td>
                  </tr>
                ) : null}
                {consentForId === player.id ? (
                  <tr>
                    <td colSpan={4} className="border-b border-line px-2 pb-3">
                      <Editor
                        pending={pending}
                        onCancel={() => setConsentForId(null)}
                        onSubmit={(event) => handleGrantConsent(event, player)}
                      >
                        <p className="mb-3 font-body text-body-sm text-ink-muted">
                          Registra quién autoriza publicar el nombre completo de{" "}
                          {player.firstName} {player.lastName}. Sin este registro, el
                          público solo verá dorsal y posición.
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field
                            label="Nombre del tutor o responsable"
                            htmlFor={`player-${player.id}-guardian`}
                          >
                            <input
                              id={`player-${player.id}-guardian`}
                              required
                              maxLength={120}
                              value={guardianName}
                              onChange={(event) => setGuardianName(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                          <Field
                            label="Relación (opcional)"
                            htmlFor={`player-${player.id}-relationship`}
                          >
                            <input
                              id={`player-${player.id}-relationship`}
                              maxLength={60}
                              value={relationship}
                              onChange={(event) => setRelationship(event.target.value)}
                              className={INPUT}
                            />
                          </Field>
                        </div>
                      </Editor>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {confirmingPlayer ? (
              <tr>
                <td colSpan={4} className="border-b border-line px-2 pb-3">
                  <Confirm
                    text={
                      force
                        ? `¿Borrar a ${confirmingPlayer.firstName} ${confirmingPlayer.lastName} y todas sus entradas de roster? Esta acción no se puede deshacer.`
                        : `¿Borrar a ${confirmingPlayer.firstName} ${confirmingPlayer.lastName}?`
                    }
                    pending={pending}
                    label={force ? "Sí, borrar jugador y roster" : "Sí, borrar jugador"}
                    onConfirm={() => void handleDelete(confirmingPlayer)}
                    onCancel={() => {
                      setConfirmingId(null);
                      setForce(false);
                    }}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </TableWrap>
      )}
    </CatalogCard>
  );
}

// ---------------------------------------------------------------------------
// Rosters

function rosterImportErrorText(error: unknown): string {
  if (error instanceof AdminApiError) {
    return rosterImportErrorMessage(error.status, error.detail);
  }
  return "Error inesperado. Inténtalo de nuevo.";
}

function RosterCsvImport({
  token,
  teamSeason,
  onImported,
}: {
  token: string;
  teamSeason: LeagueTeamSeason;
  onImported: () => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<RosterCsvParseResult | null>(null);
  const [preview, setPreview] = useState<RosterImportResult | null>(null);
  const [applied, setApplied] = useState<RosterImportResult | null>(null);
  const [pending, setPending] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState<Message>(null);

  function resetDerived() {
    setParsed(null);
    setPreview(null);
    setApplied(null);
    setMessage(null);
  }

  async function handlePreview() {
    const result = parseRosterCsv(text);
    setParsed(result);
    setPreview(null);
    setApplied(null);
    setMessage(null);

    if (result.rows.length === 0) {
      setMessage({
        kind: "error",
        text: "El CSV no contiene filas válidas. Usa una línea por jugador.",
      });
      return;
    }
    if (result.errors.length > 0) {
      setMessage({
        kind: "error",
        text: `Corrige ${result.errors.length} fila(s) antes de previsualizar.`,
      });
      return;
    }

    setPending("preview");
    try {
      const next = await importRoster(token, teamSeason.id, rosterCsvPayload(result.rows), true);
      setPreview(next);
      setMessage({
        kind: "ok",
        text: `Previsualización: ${next.created.players} jugador(es) nuevo(s), ${next.created.rosterEntries} alta(s) y ${next.updated.rosterEntries} actualización(es).`,
      });
    } catch (error) {
      setMessage({ kind: "error", text: rosterImportErrorText(error) });
    } finally {
      setPending(null);
    }
  }

  async function handleApply() {
    if (!parsed || parsed.rows.length === 0 || parsed.errors.length > 0) return;
    setPending("apply");
    setMessage(null);
    try {
      const result = await importRoster(
        token,
        teamSeason.id,
        rosterCsvPayload(parsed.rows),
        false,
      );
      setPreview(result);
      setApplied(result);
      setMessage({
        kind: "ok",
        text: `Roster importado: ${result.created.players} jugador(es) nuevo(s), ${result.created.rosterEntries} alta(s) y ${result.updated.rosterEntries} actualización(es).`,
      });
      await onImported();
    } catch (error) {
      setMessage({ kind: "error", text: rosterImportErrorText(error) });
    } finally {
      setPending(null);
    }
  }

  const canApply =
    parsed !== null &&
    parsed.rows.length > 0 &&
    parsed.errors.length === 0 &&
    applied === null &&
    pending === null;

  return (
    <details className="mt-3 border border-line">
      <summary className="cursor-pointer px-3 py-2 font-label-caps text-label-caps uppercase text-ink transition-colors hover:text-accent">
        Pegar CSV
      </summary>
      <div className="border-t border-line px-3 py-3">
        <p className="font-body text-body-sm text-ink-muted">
          Una línea por jugador: <span className="font-semibold text-ink">nombre, apellido, dorsal, posición</span>.
          Dorsal y posición pueden quedar vacíos. Las comillas permiten nombres con comas.
        </p>
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            resetDerived();
          }}
          rows={5}
          placeholder={"Ana,García,12,SS\nLuis,Pérez,,CF"}
          className="mt-2 min-h-32 w-full border border-line-strong bg-raised px-2 py-2 font-body text-body-sm text-ink outline-none transition-colors focus:border-band"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={text.trim().length === 0 || pending !== null}
            className={SMALL_BUTTON}
          >
            {pending === "preview" ? "Previsualizando…" : "Previsualizar"}
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply}
            className={SMALL_BUTTON}
          >
            {pending === "apply" ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
        {message ? (
          <div className="mt-3">
            <FormMessage message={message} />
          </div>
        ) : null}
        {parsed && parsed.errors.length > 0 ? (
          <ul className="mt-3 list-disc border-l-4 border-accent bg-accent-soft px-6 py-2 font-body text-body-sm text-ink">
            {parsed.errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                Línea {error.line}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
        {parsed && parsed.rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <th className={HEAD}>Fila</th>
                <th className={HEAD}>Nombre</th>
                <th className={HEAD}>Dorsal</th>
                <th className={HEAD}>Posición</th>
                <th className={HEAD}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, index) => {
                const resultRow = preview?.rows[index];
                return (
                  <tr key={`${row.firstName}-${row.lastName}-${index}`}>
                    <td className={CELL}>{index + 1}</td>
                    <td className={CELL}>
                      {row.firstName} {row.lastName}
                    </td>
                    <td className={CELL}>{row.jersey || "—"}</td>
                    <td className={CELL}>{row.primaryPosition || "—"}</td>
                    <td className={CELL}>
                      {resultRow ? ROSTER_ACTION_LABELS[resultRow.action] : "Pendiente"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : null}
      </div>
    </details>
  );
}

export function RosterCatalog({
  token,
  teamSeasons,
  rosters,
  onChanged,
}: {
  token: string;
  teamSeasons: LeagueTeamSeason[];
  rosters: Record<string, LeagueRosterEntry[]>;
  onChanged: () => Promise<void> | void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [jersey, setJersey] = useState("");
  const [primaryPosition, setPrimaryPosition] = useState("");
  const [eligibilityStart, setEligibilityStart] = useState("");
  const [eligibilityEnd, setEligibilityEnd] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  function beginEdit(entry: LeagueRosterEntry) {
    setMessage(null);
    setConfirmingId(null);
    setEditingId(entry.id);
    setJersey(entry.jersey ?? "");
    setPrimaryPosition(entry.primaryPosition ?? "");
    setEligibilityStart(entry.eligibilityStart ?? "");
    setEligibilityEnd(entry.eligibilityEnd ?? "");
    setStatus(entry.status);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, entry: LeagueRosterEntry) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await updateRosterEntry(
        token,
        entry.id,
        rosterUpdatePayload({
          jersey,
          primaryPosition,
          eligibilityStart,
          eligibilityEnd,
          status,
        }),
      );
      setEditingId(null);
      setMessage({ kind: "ok", text: `Roster de ${entry.firstName} ${entry.lastName} actualizado.` });
      await onChanged();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(entry: LeagueRosterEntry) {
    setPending(true);
    setMessage(null);
    try {
      await deleteRosterEntry(token, entry.id);
      setConfirmingId(null);
      setMessage({
        kind: "ok",
        text: `${entry.firstName} ${entry.lastName} eliminado del roster.`,
      });
      await onChanged();
    } catch (error) {
      setConfirmingId(null);
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <CatalogCard
      testId="list-roster"
      title="Rosters de la competencia"
      description="Edita dorsal, posición, elegibilidad y estado, o quita a un jugador del roster."
      message={message}
    >
      {teamSeasons.length === 0 ? (
        <p className="mt-4 font-body text-body-sm text-ink-muted">
          Aún no hay inscripciones en esta competencia.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {teamSeasons.map((teamSeason) => {
            const entries = rosters[teamSeason.id] ?? [];
            return (
              <div key={teamSeason.id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-title-lg uppercase text-ink">
                    {teamSeason.name}
                  </h3>
                  <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                    {entries.length} jugador(es)
                  </span>
                </div>
                <RosterCsvImport
                  token={token}
                  teamSeason={teamSeason}
                  onImported={onChanged}
                />
                {entries.length === 0 ? (
                  <p className="mt-2 font-body text-body-sm text-ink-muted">
                    Aún no hay jugadores en este roster.
                  </p>
                ) : (
                  <TableWrap>
                    <thead>
                      <tr>
                        <th className={HEAD}>Jugador</th>
                        <th className={HEAD}>Dorsal</th>
                        <th className={HEAD}>Posición</th>
                        <th className={HEAD}>Elegibilidad</th>
                        <th className={HEAD}>Estado</th>
                        <th className={HEAD}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <Fragment key={entry.id}>
                          <tr>
                            <td className={CELL}>
                              {entry.firstName} {entry.lastName}
                            </td>
                            <td className={CELL}>{entry.jersey ?? "—"}</td>
                            <td className={CELL}>{entry.primaryPosition ?? "—"}</td>
                            <td className={CELL}>
                              {formatDate(entry.eligibilityStart)} —{" "}
                              {formatDate(entry.eligibilityEnd)}
                            </td>
                            <td className={CELL}>
                              {entry.status === "active" ? "Activo" : "Inactivo"}
                            </td>
                            <td className={`${CELL} whitespace-nowrap`}>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={SMALL_BUTTON}
                                  onClick={() => beginEdit(entry)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className={SMALL_DANGER}
                                  onClick={() => {
                                    setMessage(null);
                                    setEditingId(null);
                                    setConfirmingId(entry.id);
                                  }}
                                >
                                  Quitar
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingId === entry.id ? (
                            <tr>
                              <td colSpan={6} className="border-b border-line px-2 pb-3">
                                <Editor
                                  pending={pending}
                                  onCancel={() => setEditingId(null)}
                                  onSubmit={(event) => handleSave(event, entry)}
                                >
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <Field label="Dorsal" htmlFor={`roster-${entry.id}-jersey`}>
                                      <input
                                        id={`roster-${entry.id}-jersey`}
                                        maxLength={8}
                                        value={jersey}
                                        onChange={(event) => setJersey(event.target.value)}
                                        className={INPUT}
                                      />
                                    </Field>
                                    <Field
                                      label="Posición"
                                      htmlFor={`roster-${entry.id}-position`}
                                    >
                                      <input
                                        id={`roster-${entry.id}-position`}
                                        maxLength={16}
                                        value={primaryPosition}
                                        onChange={(event) =>
                                          setPrimaryPosition(event.target.value)
                                        }
                                        className={INPUT}
                                      />
                                    </Field>
                                    <Field label="Estado" htmlFor={`roster-${entry.id}-status`}>
                                      <select
                                        id={`roster-${entry.id}-status`}
                                        value={status}
                                        onChange={(event) =>
                                          setStatus(
                                            event.target.value === "inactive"
                                              ? "inactive"
                                              : "active",
                                          )
                                        }
                                        className={INPUT}
                                      >
                                        <option value="active">Activo</option>
                                        <option value="inactive">Inactivo</option>
                                      </select>
                                    </Field>
                                    <Field
                                      label="Elegible desde"
                                      htmlFor={`roster-${entry.id}-start`}
                                    >
                                      <input
                                        id={`roster-${entry.id}-start`}
                                        type="date"
                                        value={eligibilityStart}
                                        onChange={(event) =>
                                          setEligibilityStart(event.target.value)
                                        }
                                        className={INPUT}
                                      />
                                    </Field>
                                    <Field
                                      label="Elegible hasta"
                                      htmlFor={`roster-${entry.id}-end`}
                                    >
                                      <input
                                        id={`roster-${entry.id}-end`}
                                        type="date"
                                        value={eligibilityEnd}
                                        onChange={(event) =>
                                          setEligibilityEnd(event.target.value)
                                        }
                                        className={INPUT}
                                      />
                                    </Field>
                                  </div>
                                </Editor>
                              </td>
                            </tr>
                          ) : null}
                          {confirmingId === entry.id ? (
                            <tr>
                              <td colSpan={6} className="border-b border-line px-2 pb-3">
                                <Confirm
                                  text={`¿Quitar a ${entry.firstName} ${entry.lastName} del roster de ${teamSeason.name}?`}
                                  pending={pending}
                                  label="Sí, quitar del roster"
                                  onConfirm={() => void handleDelete(entry)}
                                  onCancel={() => setConfirmingId(null)}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CatalogCard>
  );
}
