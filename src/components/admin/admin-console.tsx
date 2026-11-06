"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ADMIN_TOKEN_KEY,
  competitionPayload,
  gamePayload,
  gameStatusLabel,
  orgAdminMemberships,
  playerPayload,
  rosterEntryPayload,
  seasonPayload,
  teamPayload,
  teamSeasonPayload,
  type AdminMembership,
  type AdminOrganization,
  type AdminPlayer,
  type AdminTeam,
  type AdminUser,
} from "@/lib/admin";
import {
  AdminApiError,
  adminApiBase,
  createCompetition,
  createGame,
  createPlayer,
  createRosterEntry,
  createSeason,
  createTeam,
  createTeamSeason,
  listCompetitions,
  listGames,
  listOrganizations,
  listSeasons,
  listTeamSeasons,
  login,
  logout,
  me,
} from "@/lib/admin-api";
import type {
  LeagueCompetition,
  LeagueGame,
  LeagueRosterEntry,
  LeagueSeason,
  LeagueTeamSeason,
} from "@/lib/types";

type Phase = "booting" | "login" | "no-access" | "ready";
type Message = { kind: "ok" | "error"; text: string } | null;

const INPUT =
  "min-h-12 w-full border border-line-strong bg-raised px-3 font-body text-body-md text-ink outline-none transition-colors focus:border-band disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-ink-muted";
const LABEL = "font-label-caps text-label-caps uppercase text-ink-muted";
const BUTTON =
  "min-h-12 border-b-2 border-transparent bg-band px-6 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const EMPTY = "font-body text-body-sm text-ink-muted";

function errorText(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Error inesperado. Inténtalo de nuevo.";
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function FormCard({
  testId,
  kicker,
  title,
  description,
  children,
}: {
  testId: string;
  kicker: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="border border-line-strong bg-raised">
      <div className="h-1 bg-band" />
      <div className="p-5 md:p-6">
        <span className="font-label-caps text-label-caps uppercase text-accent">{kicker}</span>
        <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">{title}</h2>
        {description ? (
          <p className="mt-2 font-body text-body-sm text-ink-muted">{description}</p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? <span className="font-body text-body-sm text-ink-muted">{hint}</span> : null}
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

function Empty({ children }: { children: ReactNode }) {
  return <p className={EMPTY}>{children}</p>;
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className={BUTTON}>
      {pending ? "Guardando…" : children}
    </button>
  );
}

function RecordRow({ name, meta, id }: { name: string; meta?: string; id: string }) {
  return (
    <li className="border-b border-line py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-body text-body-sm text-ink">{name}</span>
        {meta ? (
          <span className="font-label-caps text-label-caps uppercase text-ink-muted">{meta}</span>
        ) : null}
      </div>
      <div className="mt-0.5 truncate font-mono text-[11px] text-ink-muted" title={id}>
        {id}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Login and access

function LoginView({
  initialError,
  onLogin,
}: {
  initialError: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(
    initialError ? { kind: "error", text: initialError } : null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      await onLogin(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 md:px-8">
      <section className="border border-line-strong bg-raised">
        <div className="h-1 bg-accent" />
        <div className="p-6 md:p-8">
          <span className="font-label-caps text-label-caps uppercase text-accent">
            Acceso restringido
          </span>
          <h1 className="mt-1 font-display text-headline-md uppercase text-ink">
            Consola de administración
          </h1>
          <p className="mt-2 font-body text-body-sm text-ink-muted">
            Inicia sesión con una cuenta con rol <span className="font-mono">org_admin</span> para
            crear temporadas, competencias, equipos, jugadores y juegos.
          </p>

          <form data-testid="form-login" onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Correo" htmlFor="admin-email">
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className={INPUT}
                placeholder="admin@liga-metropolitana.olb"
              />
            </Field>
            <Field label="Contraseña" htmlFor="admin-password">
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={INPUT}
              />
            </Field>
            <FormMessage message={message} />
            <Submit pending={pending}>Entrar</Submit>
          </form>

          <div className="mt-6 border-t border-line pt-4">
            <div className="font-label-caps text-label-caps uppercase text-ink">
              Credenciales de demostración
            </div>
            <p className="mt-1 font-mono text-[12px] break-all text-ink-muted">
              admin@liga-metropolitana.olb · olb-demo-admin
            </p>
            <p className="mt-1 font-body text-body-sm text-ink-muted">
              Solo para una instancia local con el seed de demostración.
            </p>
          </div>
        </div>
      </section>
      <p className="mt-4 text-center font-body text-body-sm text-ink-muted">
        API: <span className="font-mono">{adminApiBase()}</span>
      </p>
    </div>
  );
}

function NoAccessView({
  user,
  onLogout,
}: {
  user: AdminUser;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 md:px-8">
      <section className="border border-line-strong bg-raised">
        <div className="h-1 bg-accent" />
        <div className="p-6 md:p-8">
          <span className="font-label-caps text-label-caps uppercase text-accent">
            Acceso denegado
          </span>
          <h1 className="mt-1 font-display text-headline-md uppercase text-ink">Sin permiso</h1>
          <p className="mt-2 font-body text-body-md text-ink-muted">
            La cuenta <span className="font-mono">{user.email}</span> no tiene una membresía{" "}
            <span className="font-mono">org_admin</span>. Pide acceso a la organización o usa la
            cuenta de demostración.
          </p>
          <p className="mt-4 border-l-4 border-gold bg-surface-low px-3 py-2 font-mono text-[12px] break-all text-ink">
            admin@liga-metropolitana.olb · olb-demo-admin
          </p>
          <button
            type="button"
            onClick={() => void onLogout()}
            className={`${BUTTON} mt-6`}
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms

function SeasonForm({
  token,
  organizationId,
  onCreated,
}: {
  token: string;
  organizationId: string;
  onCreated: (season: LeagueSeason) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const year = new Date().getFullYear() + 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const season = await createSeason(
        token,
        seasonPayload(
          {
            name: String(data.get("name") ?? ""),
            year: String(data.get("year") ?? ""),
            status: data.get("status") === "archived" ? "archived" : "active",
          },
          organizationId,
        ),
      );
      onCreated(season);
      setMessage({ kind: "ok", text: `Temporada ${season.year} creada.` });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-season"
      kicker="Paso 1"
      title="Temporada"
      description="Una temporada activa archiva las demás de la organización."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre de la temporada" htmlFor="season-name">
          <input id="season-name" name="name" required maxLength={120} className={INPUT} placeholder="Temporada 2027" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Año" htmlFor="season-year">
            <input
              id="season-year"
              name="year"
              type="number"
              min={1900}
              max={9999}
              required
              defaultValue={year}
              className={INPUT}
            />
          </Field>
          <Field label="Estado" htmlFor="season-status">
            <select id="season-status" name="status" defaultValue="active" className={INPUT}>
              <option value="active">Activa</option>
              <option value="archived">Archivada</option>
            </select>
          </Field>
        </div>
        <FormMessage message={message} />
        <Submit pending={pending}>Crear temporada</Submit>
      </form>
    </FormCard>
  );
}

function CompetitionForm({
  token,
  seasons,
  selectedSeasonId,
  onSeasonChange,
  onCreated,
}: {
  token: string;
  seasons: LeagueSeason[];
  selectedSeasonId: string | null;
  onSeasonChange: (id: string) => void;
  onCreated: (competition: LeagueCompetition) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const competition = await createCompetition(
        token,
        competitionPayload({
          seasonId: String(data.get("seasonId") ?? ""),
          name: String(data.get("name") ?? ""),
          kind: data.get("kind") === "division" ? "division" : "league",
        }),
      );
      onCreated(competition);
      setMessage({ kind: "ok", text: `Competencia “${competition.name}” creada.` });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-competition"
      kicker="Paso 2"
      title="Competencia"
      description="Liga o división dentro de una temporada."
    >
      {seasons.length === 0 ? (
        <Empty>Crea una temporada antes de añadir competencias.</Empty>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Temporada de la competencia" htmlFor="competition-season">
            <select
              id="competition-season"
              name="seasonId"
              required
              value={selectedSeasonId ?? ""}
              onChange={(event) => onSeasonChange(event.target.value)}
              className={INPUT}
            >
              <option value="">— Selecciona —</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} ({season.year})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nombre de la competencia" htmlFor="competition-name">
            <input id="competition-name" name="name" required maxLength={120} className={INPUT} placeholder="Liga Mayor" />
          </Field>
          <Field label="Tipo de competencia" htmlFor="competition-kind">
            <select id="competition-kind" name="kind" defaultValue="league" className={INPUT}>
              <option value="league">Liga</option>
              <option value="division">División</option>
            </select>
          </Field>
          <FormMessage message={message} />
          <Submit pending={pending}>Crear competencia</Submit>
        </form>
      )}
    </FormCard>
  );
}

function TeamForm({
  token,
  organizationId,
  onCreated,
}: {
  token: string;
  organizationId: string;
  onCreated: (team: AdminTeam) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const team = await createTeam(
        token,
        teamPayload(
          {
            name: String(data.get("name") ?? ""),
            slug: String(data.get("slug") ?? ""),
            abbreviation: String(data.get("abbreviation") ?? ""),
          },
          organizationId,
        ),
      );
      onCreated(team);
      setMessage({ kind: "ok", text: `Equipo “${team.name}” creado.` });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-team"
      kicker="Paso 3"
      title="Equipo"
      description="El club se crea una vez; después se inscribe en cada temporada."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre del equipo" htmlFor="team-name">
          <input id="team-name" name="name" required maxLength={120} className={INPUT} placeholder="Halcones" />
        </Field>
        <Field label="Slug del equipo" htmlFor="team-slug" hint="Identificador estable en minúsculas, por ejemplo halcones.">
          <input id="team-slug" name="slug" required maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={INPUT} placeholder="halcones" />
        </Field>
        <Field label="Abreviatura" htmlFor="team-abbreviation" hint="Opcional, máximo 16 caracteres.">
          <input id="team-abbreviation" name="abbreviation" maxLength={16} className={INPUT} placeholder="HAL" />
        </Field>
        <FormMessage message={message} />
        <Submit pending={pending}>Crear equipo</Submit>
      </form>
    </FormCard>
  );
}

function TeamSeasonForm({
  token,
  seasons,
  competitions,
  teamOptions,
  selectedSeasonId,
  selectedCompetitionId,
  onSeasonChange,
  onCompetitionChange,
  onCreated,
}: {
  token: string;
  seasons: LeagueSeason[];
  competitions: LeagueCompetition[];
  teamOptions: { id: string; name: string }[];
  selectedSeasonId: string | null;
  selectedCompetitionId: string | null;
  onSeasonChange: (id: string) => void;
  onCompetitionChange: (id: string) => void;
  onCreated: (teamSeason: LeagueTeamSeason) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const ready = seasons.length > 0 && competitions.length > 0 && teamOptions.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const teamSeason = await createTeamSeason(
        token,
        teamSeasonPayload({
          teamId: String(data.get("teamId") ?? ""),
          seasonId: String(data.get("seasonId") ?? ""),
          competitionId: String(data.get("competitionId") ?? ""),
          name: String(data.get("name") ?? ""),
          abbreviation: String(data.get("abbreviation") ?? ""),
        }),
      );
      onCreated(teamSeason);
      setMessage({ kind: "ok", text: `Inscripción “${teamSeason.name}” creada.` });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-team-season"
      kicker="Paso 4"
      title="Equipo en temporada"
      description="Inscribe un equipo en una competencia concreta."
    >
      {!ready ? (
        <Empty>
          Necesitas una temporada, una competencia y al menos un equipo. Crea los pasos 1–3.
        </Empty>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Equipo de la inscripción" htmlFor="team-season-team">
            <select id="team-season-team" name="teamId" required defaultValue="" className={INPUT}>
              <option value="">— Selecciona —</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Temporada de la inscripción" htmlFor="team-season-season">
              <select
                id="team-season-season"
                name="seasonId"
                required
                value={selectedSeasonId ?? ""}
                onChange={(event) => onSeasonChange(event.target.value)}
                className={INPUT}
              >
                <option value="">— Selecciona —</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.year})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Competencia de la inscripción" htmlFor="team-season-competition">
              <select
                id="team-season-competition"
                name="competitionId"
                required
                value={selectedCompetitionId ?? ""}
                onChange={(event) => onCompetitionChange(event.target.value)}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre en la temporada" htmlFor="team-season-name" hint="Opcional; por defecto usa el del equipo.">
              <input id="team-season-name" name="name" maxLength={120} className={INPUT} />
            </Field>
            <Field label="Abreviatura en la temporada" htmlFor="team-season-abbreviation">
              <input id="team-season-abbreviation" name="abbreviation" maxLength={16} className={INPUT} />
            </Field>
          </div>
          <FormMessage message={message} />
          <Submit pending={pending}>Inscribir equipo</Submit>
        </form>
      )}
    </FormCard>
  );
}

function PlayerForm({
  token,
  organizationId,
  onCreated,
}: {
  token: string;
  organizationId: string;
  onCreated: (player: AdminPlayer) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const player = await createPlayer(
        token,
        playerPayload(
          {
            firstName: String(data.get("firstName") ?? ""),
            lastName: String(data.get("lastName") ?? ""),
          },
          organizationId,
        ),
      );
      onCreated(player);
      setMessage({
        kind: "ok",
        text: `Jugador ${player.firstName} ${player.lastName} creado.`,
      });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-player"
      kicker="Paso 5"
      title="Jugador"
      description="El jugador pertenece a la organización y luego entra en un roster."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre del jugador" htmlFor="player-first-name">
            <input id="player-first-name" name="firstName" required maxLength={120} className={INPUT} placeholder="Ana" />
          </Field>
          <Field label="Apellido del jugador" htmlFor="player-last-name">
            <input id="player-last-name" name="lastName" required maxLength={120} className={INPUT} placeholder="Pérez" />
          </Field>
        </div>
        <FormMessage message={message} />
        <Submit pending={pending}>Crear jugador</Submit>
      </form>
    </FormCard>
  );
}

function RosterForm({
  token,
  teamSeasons,
  players,
  onCreated,
}: {
  token: string;
  teamSeasons: LeagueTeamSeason[];
  players: AdminPlayer[];
  onCreated: (entry: LeagueRosterEntry) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const ready = teamSeasons.length > 0 && players.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const entry = await createRosterEntry(
        token,
        rosterEntryPayload({
          teamSeasonId: String(data.get("teamSeasonId") ?? ""),
          playerId: String(data.get("playerId") ?? ""),
          jersey: String(data.get("jersey") ?? ""),
          primaryPosition: String(data.get("primaryPosition") ?? ""),
        }),
      );
      onCreated(entry);
      setMessage({
        kind: "ok",
        text: `Roster: ${entry.firstName} ${entry.lastName} añadido.`,
      });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-roster"
      kicker="Paso 6"
      title="Entrada de roster"
      description="Asigna un jugador creado en esta sesión al equipo de la competencia seleccionada."
    >
      {!ready ? (
        <Empty>
          Necesitas una inscripción de equipo en la competencia seleccionada y un jugador creado
          en esta sesión.
        </Empty>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Equipo en temporada" htmlFor="roster-team-season">
            <select id="roster-team-season" name="teamSeasonId" required defaultValue="" className={INPUT}>
              <option value="">— Selecciona —</option>
              {teamSeasons.map((teamSeason) => (
                <option key={teamSeason.id} value={teamSeason.id}>
                  {teamSeason.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jugador creado" htmlFor="roster-player">
            <select id="roster-player" name="playerId" required defaultValue="" className={INPUT}>
              <option value="">— Selecciona —</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.firstName} {player.lastName}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dorsal" htmlFor="roster-jersey">
              <input id="roster-jersey" name="jersey" maxLength={8} className={INPUT} placeholder="27" />
            </Field>
            <Field label="Posición" htmlFor="roster-position">
              <input id="roster-position" name="primaryPosition" maxLength={16} className={INPUT} placeholder="CF" />
            </Field>
          </div>
          <FormMessage message={message} />
          <Submit pending={pending}>Añadir al roster</Submit>
        </form>
      )}
    </FormCard>
  );
}

function GameForm({
  token,
  seasons,
  competitions,
  teamSeasons,
  selectedSeasonId,
  selectedCompetitionId,
  onSeasonChange,
  onCompetitionChange,
  onCreated,
}: {
  token: string;
  seasons: LeagueSeason[];
  competitions: LeagueCompetition[];
  teamSeasons: LeagueTeamSeason[];
  selectedSeasonId: string | null;
  selectedCompetitionId: string | null;
  onSeasonChange: (id: string) => void;
  onCompetitionChange: (id: string) => void;
  onCreated: (game: LeagueGame) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const ready = competitions.length > 0 && teamSeasons.length >= 2;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setMessage(null);
    try {
      const game = await createGame(
        token,
        gamePayload({
          seasonId: String(data.get("seasonId") ?? ""),
          competitionId: String(data.get("competitionId") ?? ""),
          homeTeamSeasonId: String(data.get("homeTeamSeasonId") ?? ""),
          awayTeamSeasonId: String(data.get("awayTeamSeasonId") ?? ""),
          scheduledStart: String(data.get("scheduledStart") ?? ""),
          venue: String(data.get("venue") ?? ""),
        }),
      );
      onCreated(game);
      setMessage({ kind: "ok", text: `Juego ${game.homeTeam} vs ${game.awayTeam} programado.` });
      form.reset();
    } catch (error) {
      setMessage({ kind: "error", text: errorText(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormCard
      testId="form-game"
      kicker="Paso 7"
      title="Juego programado"
      description="Crea el juego en el catálogo; el acta se abre desde el scorer."
    >
      {!ready ? (
        <Empty>
          Necesitas una competencia con al menos dos equipos inscritos. Completa los pasos 1–4.
        </Empty>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Temporada del juego" htmlFor="game-season">
              <select
                id="game-season"
                name="seasonId"
                required
                value={selectedSeasonId ?? ""}
                onChange={(event) => onSeasonChange(event.target.value)}
                className={INPUT}
              >
                <option value="">— Selecciona —</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.year})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Competencia del juego" htmlFor="game-competition">
              <select
                id="game-competition"
                name="competitionId"
                required
                value={selectedCompetitionId ?? ""}
                onChange={(event) => onCompetitionChange(event.target.value)}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Equipo local" htmlFor="game-home">
              <select id="game-home" name="homeTeamSeasonId" required defaultValue="" className={INPUT}>
                <option value="">— Selecciona —</option>
                {teamSeasons.map((teamSeason) => (
                  <option key={teamSeason.id} value={teamSeason.id}>
                    {teamSeason.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Equipo visitante" htmlFor="game-away">
              <select id="game-away" name="awayTeamSeasonId" required defaultValue="" className={INPUT}>
                <option value="">— Selecciona —</option>
                {teamSeasons.map((teamSeason) => (
                  <option key={teamSeason.id} value={teamSeason.id}>
                    {teamSeason.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Inicio programado" htmlFor="game-start">
              <input id="game-start" name="scheduledStart" type="datetime-local" className={INPUT} />
            </Field>
            <Field label="Sede" htmlFor="game-venue">
              <input id="game-venue" name="venue" maxLength={200} className={INPUT} placeholder="Parque Central" />
            </Field>
          </div>
          <FormMessage message={message} />
          <Submit pending={pending}>Programar juego</Submit>
        </form>
      )}
    </FormCard>
  );
}

// ---------------------------------------------------------------------------
// Console

export function AdminConsole() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [competitions, setCompetitions] = useState<LeagueCompetition[]>([]);
  const [teamSeasons, setTeamSeasons] = useState<LeagueTeamSeason[]>([]);
  const [games, setGames] = useState<LeagueGame[]>([]);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [rosterEntries, setRosterEntries] = useState<LeagueRosterEntry[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null);
  const [gamesReload, setGamesReload] = useState(0);

  const applyIdentity = useCallback(
    (nextToken: string, nextUser: AdminUser, nextMemberships: AdminMembership[]) => {
      const admin = orgAdminMemberships(nextMemberships);
      setToken(nextToken);
      setUser(nextUser);
      setMemberships(nextMemberships);
      setOrganizationId(admin[0]?.scopeId ?? null);
      setPhase(admin.length > 0 ? "ready" : "no-access");
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const stored = window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!stored) {
      setPhase("login");
      return;
    }
    me(stored)
      .then((identity) => {
        if (cancelled) return;
        applyIdentity(stored, identity.user, identity.memberships);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AdminApiError && error.status === 401) {
          window.localStorage.removeItem(ADMIN_TOKEN_KEY);
        }
        setBootError(errorText(error));
        setPhase("login");
      });
    return () => {
      cancelled = true;
    };
  }, [applyIdentity]);

  useEffect(() => {
    if (phase !== "ready") return;
    listOrganizations()
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  }, [phase]);

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    setTeams([]);
    setPlayers([]);
    setRosterEntries([]);
    setSeasons([]);
    setCompetitions([]);
    setTeamSeasons([]);
    setGames([]);
    setSelectedSeasonId(null);
    setSelectedCompetitionId(null);
    listSeasons(organizationId)
      .then((rows) => {
        if (cancelled) return;
        setSeasons(rows);
        setSelectedSeasonId(
          rows.find((season) => season.status === "active")?.id ?? rows[0]?.id ?? null,
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  useEffect(() => {
    if (!token || !selectedSeasonId) {
      setCompetitions([]);
      setSelectedCompetitionId(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    listCompetitions(selectedSeasonId)
      .then((rows) => {
        if (cancelled) return;
        setCompetitions(rows);
        setSelectedCompetitionId((current) =>
          current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? null),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCompetitions([]);
        setSelectedCompetitionId(null);
        setLoadError(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedSeasonId]);

  useEffect(() => {
    if (!token || !selectedCompetitionId) {
      setTeamSeasons([]);
      return;
    }
    let cancelled = false;
    listTeamSeasons(selectedCompetitionId)
      .then((rows) => {
        if (!cancelled) setTeamSeasons(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTeamSeasons([]);
        setLoadError(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedCompetitionId]);

  useEffect(() => {
    if (!token || !selectedSeasonId) {
      setGames([]);
      return;
    }
    let cancelled = false;
    listGames(selectedSeasonId)
      .then((rows) => {
        if (!cancelled) setGames(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGames([]);
        setLoadError(errorText(error));
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedSeasonId, gamesReload]);

  async function handleLogin(email: string, password: string) {
    const session = await login(email, password);
    window.localStorage.setItem(ADMIN_TOKEN_KEY, session.token);
    setBootError(null);
    applyIdentity(session.token, session.user, session.memberships);
  }

  async function handleLogout() {
    if (token) {
      await logout(token).catch(() => undefined);
    }
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setMemberships([]);
    setOrganizationId(null);
    setSeasons([]);
    setCompetitions([]);
    setTeamSeasons([]);
    setGames([]);
    setTeams([]);
    setPlayers([]);
    setRosterEntries([]);
    setSelectedSeasonId(null);
    setSelectedCompetitionId(null);
    setLoadError(null);
    setPhase("login");
  }

  function handleSeasonChange(id: string) {
    setSelectedSeasonId(id);
    setSelectedCompetitionId(null);
    setCompetitions([]);
    setTeamSeasons([]);
    setGames([]);
  }

  async function refreshSeasons(preferredId: string) {
    if (!organizationId) return;
    try {
      const rows = await listSeasons(organizationId);
      setSeasons(rows);
      setSelectedSeasonId(preferredId);
    } catch (error) {
      setLoadError(errorText(error));
    }
  }

  async function refreshCompetitions(seasonId: string, preferredId: string) {
    try {
      const rows = await listCompetitions(seasonId);
      setCompetitions(rows);
      setSelectedCompetitionId(preferredId);
    } catch (error) {
      setLoadError(errorText(error));
    }
  }

  async function refreshTeamSeasons(competitionId: string) {
    try {
      setTeamSeasons(await listTeamSeasons(competitionId));
    } catch (error) {
      setLoadError(errorText(error));
    }
  }

  if (phase === "booting") {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-8">
        <p className="font-body text-body-md text-ink-muted">Comprobando sesión…</p>
      </div>
    );
  }

  if (phase === "login") {
    return <LoginView initialError={bootError} onLogin={handleLogin} />;
  }

  if (phase === "no-access" && user) {
    return <NoAccessView user={user} onLogout={handleLogout} />;
  }

  const orgMemberships = orgAdminMemberships(memberships);
  const organization =
    organizations.find((row) => row.id === organizationId) ?? null;
  const knownTeamMap = new Map<string, string>();
  for (const teamSeason of teamSeasons) knownTeamMap.set(teamSeason.teamId, teamSeason.teamName);
  for (const team of teams) knownTeamMap.set(team.id, team.name);
  const teamOptions = [...knownTeamMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <section className="bg-band text-band-ink">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-accent px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink">
              Consola de liga
            </span>
            <span className="font-label-caps text-label-caps uppercase text-band-muted">
              org_admin · {user?.email}
            </span>
          </div>
          <h1 className="mt-4 font-display text-display-hero-mobile uppercase sm:text-display-hero">
            Administración
          </h1>
          <p className="mt-4 max-w-3xl font-body text-body-md text-band-muted">
            Alta guiada del catálogo: temporada, competencia, equipo, inscripción, jugador, roster
            y juego programado. Las lecturas son públicas; cada escritura usa tu sesión Bearer.
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-4">
            {orgMemberships.length > 1 ? (
              <label className="flex flex-col gap-1.5">
                <span className="font-label-caps text-label-caps uppercase text-band-muted">
                  Organización
                </span>
                <select
                  value={organizationId ?? ""}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  className="min-h-12 border border-band-muted bg-band px-3 font-body text-body-md text-band-ink outline-none focus:border-gold"
                >
                  {orgMemberships.map((membership) => (
                    <option key={membership.id} value={membership.scopeId}>
                      {organizations.find((row) => row.id === membership.scopeId)?.name ??
                        membership.scopeId}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div>
                <div className="font-label-caps text-label-caps uppercase text-band-muted">
                  Organización
                </div>
                <div className="mt-1 font-body text-body-md text-band-ink">
                  {organization?.name ?? organizationId ?? "—"}
                </div>
              </div>
            )}
            <div>
              <div className="font-label-caps text-label-caps uppercase text-band-muted">
                Temporadas
              </div>
              <div className="mt-1 font-tabular-stats text-tabular-stats">{seasons.length}</div>
            </div>
            <div>
              <div className="font-label-caps text-label-caps uppercase text-band-muted">
                Competencias
              </div>
              <div className="mt-1 font-tabular-stats text-tabular-stats">
                {competitions.length}
              </div>
            </div>
            <div>
              <div className="font-label-caps text-label-caps uppercase text-band-muted">
                Inscripciones
              </div>
              <div className="mt-1 font-tabular-stats text-tabular-stats">
                {teamSeasons.length}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="ml-auto min-h-12 border border-band-muted px-4 font-label-caps text-label-caps uppercase text-band-ink transition-colors hover:border-gold"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        {loadError ? (
          <div className="mb-6 border-l-4 border-accent bg-accent-soft px-4 py-3 font-body text-body-sm text-ink">
            {loadError}
          </div>
        ) : null}

        {token && organizationId ? (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
            <SeasonForm
              token={token}
              organizationId={organizationId}
              onCreated={(season) => {
                setSelectedSeasonId(season.id);
                void refreshSeasons(season.id);
              }}
            />
            <CompetitionForm
              token={token}
              seasons={seasons}
              selectedSeasonId={selectedSeasonId}
              onSeasonChange={handleSeasonChange}
              onCreated={(competition) => {
                setSelectedCompetitionId(competition.id);
                void refreshCompetitions(competition.seasonId, competition.id);
              }}
            />
            <TeamForm
              token={token}
              organizationId={organizationId}
              onCreated={(team) => {
                setTeams((current) => [...current.filter((row) => row.id !== team.id), team]);
              }}
            />
            <TeamSeasonForm
              token={token}
              seasons={seasons}
              competitions={competitions}
              teamOptions={teamOptions}
              selectedSeasonId={selectedSeasonId}
              selectedCompetitionId={selectedCompetitionId}
              onSeasonChange={handleSeasonChange}
              onCompetitionChange={setSelectedCompetitionId}
              onCreated={(teamSeason) => {
                if (teamSeason.competitionId) {
                  void refreshTeamSeasons(teamSeason.competitionId);
                }
              }}
            />
            <PlayerForm
              token={token}
              organizationId={organizationId}
              onCreated={(player) => {
                setPlayers((current) => [
                  ...current.filter((row) => row.id !== player.id),
                  player,
                ]);
              }}
            />
            <RosterForm
              token={token}
              teamSeasons={teamSeasons}
              players={players}
              onCreated={(entry) => {
                setRosterEntries((current) => [
                  ...current.filter((row) => row.id !== entry.id),
                  entry,
                ]);
              }}
            />
            <div className="xl:col-span-2">
              <GameForm
                token={token}
                seasons={seasons}
                competitions={competitions}
                teamSeasons={teamSeasons}
                selectedSeasonId={selectedSeasonId}
                selectedCompetitionId={selectedCompetitionId}
                onSeasonChange={handleSeasonChange}
                onCompetitionChange={setSelectedCompetitionId}
                onCreated={() => {
                  setGamesReload((value) => value + 1);
                }}
              />
            </div>

            <section
              data-testid="list-teams"
              className="border border-line-strong bg-raised p-5 md:p-6"
            >
              <h2 className="font-display text-headline-sm uppercase text-ink">
                Equipos creados
              </h2>
              <p className="mt-1 font-body text-body-sm text-ink-muted">
                Solo los equipos creados en esta sesión.
              </p>
              {teams.length === 0 ? (
                <div className="mt-4">
                  <Empty>Todavía no hay equipos creados.</Empty>
                </div>
              ) : (
                <ul className="mt-4">
                  {teams.map((team) => (
                    <RecordRow
                      key={team.id}
                      id={team.id}
                      name={team.name}
                      meta={[team.abbreviation, team.slug].filter(Boolean).join(" · ")}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section
              data-testid="list-players"
              className="border border-line-strong bg-raised p-5 md:p-6"
            >
              <h2 className="font-display text-headline-sm uppercase text-ink">
                Jugadores creados
              </h2>
              <p className="mt-1 font-body text-body-sm text-ink-muted">
                Solo los jugadores creados en esta sesión.
              </p>
              {players.length === 0 ? (
                <div className="mt-4">
                  <Empty>Todavía no hay jugadores creados.</Empty>
                </div>
              ) : (
                <ul className="mt-4">
                  {players.map((player) => (
                    <RecordRow
                      key={player.id}
                      id={player.id}
                      name={`${player.firstName} ${player.lastName}`}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section
              data-testid="list-roster"
              className="border border-line-strong bg-raised p-5 md:p-6"
            >
              <h2 className="font-display text-headline-sm uppercase text-ink">
                Roster de esta sesión
              </h2>
              {rosterEntries.length === 0 ? (
                <div className="mt-4">
                  <Empty>Todavía no hay entradas de roster.</Empty>
                </div>
              ) : (
                <ul className="mt-4">
                  {rosterEntries.map((entry) => (
                    <RecordRow
                      key={entry.id}
                      id={entry.id}
                      name={`${entry.firstName} ${entry.lastName}`}
                      meta={[entry.jersey ? `#${entry.jersey}` : null, entry.primaryPosition]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </ul>
              )}
            </section>

            <section
              data-testid="list-games"
              className="border border-line-strong bg-raised p-5 md:p-6"
            >
              <h2 className="font-display text-headline-sm uppercase text-ink">
                Juegos de la temporada
              </h2>
              {games.length === 0 ? (
                <div className="mt-4">
                  <Empty>Todavía no hay juegos en esta temporada.</Empty>
                </div>
              ) : (
                <ul className="mt-4">
                  {games.map((game) => (
                    <RecordRow
                      key={game.id}
                      id={game.id}
                      name={`${game.awayTeam} @ ${game.homeTeam}`}
                      meta={[
                        gameStatusLabel(game.status),
                        formatTimestamp(game.scheduledStart),
                        game.venue,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
