"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/scorer/auth-provider";
import { GameCard } from "@/components/scorer/game-card";
import { LoginCard } from "@/components/scorer/login-card";
import { ScorerShell } from "@/components/scorer/scorer-shell";
import {
  ApiError,
  getGameState,
  listCompetitions,
  listGames,
  listSeasonGames,
  listSeasons,
  listTeams,
  prepareLeagueGame,
  scheduledGamesForMemberships,
  toLocalGame,
  type ApiGame,
  type LeagueGame,
  type Season,
  type TeamSeason,
} from "@/lib/scorer/api";
import {
  localGameStatus,
  remoteGameStatus,
  type LocalGameStatus,
  type RemoteGameStatus,
} from "@/lib/scorer/game-status";
import { localStore } from "@/lib/scorer/store";
import type { LocalGame } from "@/lib/scorer/types";

interface LocalRow {
  game: LocalGame;
  status: LocalGameStatus;
}

interface RemoteRow {
  game: ApiGame;
  status: RemoteGameStatus;
}

function formatSchedule(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function leagueMeta(game: LeagueGame): string | null {
  return [game.venue, formatSchedule(game.scheduledStart)].filter(Boolean).join(" · ") || null;
}

export default function Home() {
  const { user, memberships, loading: authLoading } = useAuth();

  const [localGames, setLocalGames] = useState<LocalRow[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(true);

  const [remoteGames, setRemoteGames] = useState<RemoteRow[]>([]);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(true);

  const [leagueGames, setLeagueGames] = useState<LeagueGame[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<TeamSeason[]>([]);
  const [leagueSeason, setLeagueSeason] = useState<Season | null>(null);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [leagueNotice, setLeagueNotice] = useState<string | null>(null);
  const [loadingLeague, setLoadingLeague] = useState(false);

  const [preparing, setPreparing] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadLocal = useCallback(async () => {
    setLoadingLocal(true);
    setLocalError(null);
    try {
      const store = localStore();
      const games = await store.listGames();
      const rows = await Promise.all(
        games.map(async (game) => ({
          game,
          status: localGameStatus(game, await store.listEvents(game.id)),
        })),
      );
      if (!mounted.current) return;
      rows.sort((a, b) => b.game.createdAt.localeCompare(a.game.createdAt));
      setLocalGames(rows);
    } catch {
      if (mounted.current) {
        setLocalError("No pudimos abrir los juegos de este dispositivo.");
      }
    } finally {
      if (mounted.current) setLoadingLocal(false);
    }
  }, []);

  const loadRemote = useCallback(async () => {
    setLoadingRemote(true);
    setRemoteError(null);
    try {
      const games = await listGames();
      const rows = await Promise.all(
        games.map(async (game): Promise<RemoteRow> => {
          try {
            const state = await getGameState(game.id);
            return { game, status: remoteGameStatus(state) };
          } catch {
            // The list is still useful when the state endpoint fails; the
            // card falls back to the last sequence number it already has.
            return { game, status: game.lastSeq > 0 ? "En curso" : "Programado" };
          }
        }),
      );
      if (!mounted.current) return;
      // Only scheduled games can be prepared: preparing imports the record but
      // not the event log, so a live or final game would restart from empty.
      setRemoteGames(rows.filter((row) => row.status === "Programado"));
    } catch (error) {
      if (!mounted.current) return;
      setRemoteGames([]);
      setRemoteError(
        error instanceof ApiError
          ? error.message
          : "No pudimos cargar los juegos de la liga.",
      );
    } finally {
      if (mounted.current) setLoadingRemote(false);
    }
  }, []);

  const loadLeague = useCallback(async () => {
    if (!user) {
      setLeagueGames([]);
      setLeagueTeams([]);
      setLeagueSeason(null);
      setLeagueError(null);
      setLeagueNotice(null);
      setLoadingLeague(false);
      return;
    }

    setLoadingLeague(true);
    setLeagueError(null);
    setLeagueNotice(null);

    try {
      const seasons = await listSeasons();
      const season =
        seasons.find((entry) => entry.status === "active") ?? seasons[0] ?? null;

      if (!season) {
        if (!mounted.current) return;
        setLeagueSeason(null);
        setLeagueGames([]);
        setLeagueTeams([]);
        setLeagueNotice("La liga no tiene temporadas.");
        return;
      }

      const competitions = await listCompetitions(season.id);
      const teamGroups = await Promise.all(
        competitions.map((competition) => listTeams(competition.id)),
      );
      const games = await listSeasonGames(season.id);
      if (!mounted.current) return;

      const visible = scheduledGamesForMemberships(
        games,
        memberships,
        season.organizationId,
      );
      const scheduled = games.filter((game) => game.status === "scheduled");

      setLeagueSeason(season);
      setLeagueTeams(teamGroups.flat());
      setLeagueGames(visible);
      setLeagueNotice(
        visible.length > 0
          ? null
          : scheduled.length > 0
            ? "No tienes juegos programados en esta temporada."
            : "La liga no tiene juegos programados.",
      );
    } catch (error) {
      if (!mounted.current) return;
      setLeagueGames([]);
      setLeagueTeams([]);
      setLeagueSeason(null);
      setLeagueError(
        error instanceof ApiError
          ? error.message
          : "No pudimos cargar los juegos de tu equipo.",
      );
    } finally {
      if (mounted.current) setLoadingLeague(false);
    }
  }, [user, memberships]);

  useEffect(() => {
    void loadLocal();
    void loadRemote();
  }, [loadLocal, loadRemote]);

  useEffect(() => {
    void loadLeague();
  }, [loadLeague]);

  async function prepare(game: ApiGame): Promise<void> {
    setPreparing(game.id);
    try {
      const store = localStore();
      const existing = await store.getGame(game.id);
      if (!existing) await store.putGame(toLocalGame(game));
      window.location.assign(`/score/${game.id}`);
    } catch {
      setRemoteError("No pudimos preparar ese juego en este dispositivo.");
      setPreparing(null);
    }
  }

  async function prepareLeague(game: LeagueGame): Promise<void> {
    setPreparing(game.id);
    try {
      const prepared = await prepareLeagueGame(game.id);
      const store = localStore();
      const existing = await store.getGame(game.id);
      // Keep the lineups and rules this device already edited; the league
      // metadata and rosters come from the server.
      const merged: LocalGame = existing
        ? { ...prepared, lineups: existing.lineups, rules: existing.rules }
        : prepared;
      await store.putGame(merged);
      window.location.assign(`/score/${game.id}`);
    } catch (error) {
      setLeagueError(
        error instanceof ApiError
          ? error.message
          : "No pudimos preparar ese juego en este dispositivo.",
      );
      setPreparing(null);
    }
  }

  // A signed-in user sees the league section only. The legacy server list is
  // for anonymous devices and would otherwise repeat every scheduled game.
  const showLegacy = !user;
  const empty =
    localGames.length === 0 &&
    leagueGames.length === 0 &&
    (!showLegacy || remoteGames.length === 0);

  return (
    <ScorerShell
      title="OLB Scorer"
      subtitle="Anotación offline · Liga Metropolitana"
      actions={
        <Link
          href="/score/new"
          className="inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band"
        >
          Nuevo juego
        </Link>
      }
    >
      <div className="space-y-space-xl">
        {!authLoading && !user ? <LoginCard /> : null}

        <section aria-labelledby="local-heading">
          <div className="mb-space-sm flex items-end justify-between gap-space-md">
            <h2
              id="local-heading"
              className="font-display text-headline-sm text-ink"
            >
              Tus juegos
            </h2>
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              Este dispositivo
            </span>
          </div>

          {loadingLocal ? (
            <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
              Leyendo el registro local…
            </p>
          ) : localError ? (
            <div className="border border-line-strong bg-raised px-space-md py-space-md">
              <p className="font-body text-body-md text-ink">{localError}</p>
              <button
                type="button"
                onClick={() => void loadLocal()}
                className="mt-space-sm inline-flex min-h-12 items-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
              >
                Reintentar
              </button>
            </div>
          ) : localGames.length === 0 ? (
            <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
              Todavía no hay juegos en este dispositivo.
            </p>
          ) : (
            <ul className="space-y-space-sm">
              {localGames.map(({ game, status }) => (
                <li key={game.id}>
                  <GameCard
                    awayTeam={game.awayTeam}
                    homeTeam={game.homeTeam}
                    status={status}
                    meta={formatSchedule(game.scheduledStart)}
                    href={`/score/${game.id}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {user ? (
          <section aria-labelledby="scheduled-league-heading">
            <div className="mb-space-sm flex items-end justify-between gap-space-md">
              <h2
                id="scheduled-league-heading"
                className="font-display text-headline-sm text-ink"
              >
                Liga
              </h2>
              <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                {leagueSeason
                  ? `${leagueSeason.name}${leagueTeams.length > 0 ? ` · ${leagueTeams.length} equipos` : ""}`
                  : "Temporada"}
              </span>
            </div>

            {loadingLeague ? (
              <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
                Consultando los juegos de tu equipo…
              </p>
            ) : leagueError ? (
              <div className="border border-line-strong bg-raised px-space-md py-space-md">
                <p className="font-body text-body-md text-ink">{leagueError}</p>
                <button
                  type="button"
                  onClick={() => void loadLeague()}
                  className="mt-space-sm inline-flex min-h-12 items-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
                >
                  Reintentar
                </button>
              </div>
            ) : leagueNotice ? (
              <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
                {leagueNotice}
              </p>
            ) : (
              <ul className="space-y-space-sm">
                {leagueGames.map((game) => (
                  <li key={game.id}>
                    <GameCard
                      awayTeam={game.awayTeam}
                      homeTeam={game.homeTeam}
                      status={remoteGameStatus({ status: game.status })}
                      meta={leagueMeta(game)}
                      href={`/score/${game.id}`}
                      action={
                        <button
                          type="button"
                          disabled={preparing === game.id}
                          onClick={() => void prepareLeague(game)}
                          className="inline-flex min-h-12 w-full items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                        >
                          {preparing === game.id ? "Preparando…" : "Preparar"}
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {showLegacy ? (
          <section aria-labelledby="league-heading">
            <div className="mb-space-sm flex items-end justify-between gap-space-md">
              <h2
                id="league-heading"
              className="font-display text-headline-sm text-ink"
            >
              Juegos del servidor
            </h2>
            <span className="font-label-caps text-label-caps uppercase text-ink-muted">
              Servidor
            </span>
          </div>

          {loadingRemote ? (
            <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
              Consultando la liga…
            </p>
          ) : remoteError ? (
            <div className="border border-line-strong bg-raised px-space-md py-space-md">
              <p className="font-body text-body-md text-ink">{remoteError}</p>
              <p className="mt-space-xs font-body text-body-sm text-ink-muted">
                Tus juegos locales siguen disponibles sin conexión.
              </p>
              <button
                type="button"
                onClick={() => void loadRemote()}
                className="mt-space-sm inline-flex min-h-12 items-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
              >
                Reintentar
              </button>
            </div>
          ) : remoteGames.length === 0 ? (
            <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
              La liga no tiene juegos programados.
            </p>
          ) : (
            <ul className="space-y-space-sm">
              {remoteGames.map(({ game, status }) => (
                <li key={game.id}>
                  <GameCard
                    awayTeam={game.awayTeam}
                    homeTeam={game.homeTeam}
                    status={status}
                    meta={formatSchedule(game.scheduledStart)}
                    href={`/score/${game.id}`}
                    action={
                      <button
                        type="button"
                        disabled={preparing === game.id}
                        onClick={() => void prepare(game)}
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                      >
                        {preparing === game.id ? "Preparando…" : "Preparar"}
                      </button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          </section>
        ) : null}

        {empty &&
        !loadingLocal &&
        !loadingRemote &&
        !loadingLeague &&
        !localError &&
        !remoteError ? (
          <p className="border border-line bg-surface-low px-space-md py-space-md font-body text-body-md text-ink-muted">
            No hay juegos todavía. Crea uno para empezar a anotar.
          </p>
        ) : null}
      </div>
    </ScorerShell>
  );
}
