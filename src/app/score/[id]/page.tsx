"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LineupEditor } from "@/components/scorer/lineup-editor";
import { useAuth } from "@/components/scorer/auth-provider";
import { ReadOnlyPanel } from "@/components/scorer/read-only-panel";
import { RulesCard } from "@/components/scorer/rules-card";
import { ScorerShell } from "@/components/scorer/scorer-shell";
import { VerifierLink } from "@/components/scorer/verifier-link";
import { ApiError, prepareLeagueGame } from "@/lib/scorer/api";
import { localGameStatus } from "@/lib/scorer/game-status";
import { hasScoringRole } from "@/lib/scorer/roles";
import { lineupStartErrors, rosterStartErrors } from "@/lib/scorer/start";
import { rosterToLineup } from "@/lib/scorer/roster";
import { DEFAULT_RULES, validateRules, type RulesProfile } from "@/lib/scorer/rules";
import { blankLineup, buildLineupEvents, buildStartEvents } from "@/lib/scorer/setup";
import { localStore } from "@/lib/scorer/store";
import type { Lineup, LocalGame, StoredEvent } from "@/lib/scorer/types";

interface SetupLineups {
  home: Lineup;
  away: Lineup;
}

interface LineupErrors {
  home: string[];
  away: string[];
}

function formatGameDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function GameSetupPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const router = useRouter();
  const { user, memberships } = useAuth();

  const [game, setGame] = useState<LocalGame | null>(null);
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [lineups, setLineups] = useState<SetupLineups | null>(null);
  const [rules, setRules] = useState<RulesProfile>(DEFAULT_RULES);
  const [errors, setErrors] = useState<LineupErrors>({ home: [], away: [] });
  const [rosterErrors, setRosterErrors] = useState<{
    home: string | null;
    away: string | null;
  }>({ home: null, away: null });
  const [rulesErrors, setRulesErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rosterNote, setRosterNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (!id) {
        setLoadError("No encontramos ese juego.");
        setLoading(false);
        return;
      }

      const store = localStore();
      let local = await store.getGame(id);
      let leagueNotice: string | null = null;

      // A record saved by an older build, or by the home "Preparar" button,
      // may carry no rosters. The league is the source for both rosters and
      // the team-season ids; local lineups and the event log stay untouched.
      if (!local || !local.rosters || !local.teamSeasonIds) {
        try {
          const prepared = await prepareLeagueGame(id);
          local = local ? { ...prepared, lineups: local.lineups } : prepared;
          await store.putGame(local);
        } catch (caught) {
          if (!local) {
            if (!cancelled) {
              setLoadError(
                caught instanceof ApiError
                  ? caught.message
                  : "No encontramos ese juego.",
              );
              setLoading(false);
            }
            return;
          }
          leagueNotice =
            "No pudimos actualizar el juego desde la liga; seguimos con los datos de este dispositivo.";
        }
      }

      if (!local) {
        if (!cancelled) {
          setLoadError("No encontramos ese juego.");
          setLoading(false);
        }
        return;
      }

      let importNote: string | null = null;
      if (
        local.rosters &&
        local.lineups.home === null &&
        local.lineups.away === null
      ) {
        const home = rosterToLineup(local.rosters.home, "home", local.rules, {
          fallback: true,
        });
        const away = rosterToLineup(local.rosters.away, "away", local.rules, {
          fallback: true,
        });

        if (home.lineup && away.lineup) {
          local = {
            ...local,
            lineups: { home: home.lineup, away: away.lineup },
          };
          await store.putGame(local);
          importNote = "Plantillas importadas";
        } else if (!cancelled) {
          setRosterErrors({
            home: home.error,
            away: away.error,
          });
        }
      }

      const stored = await store.listEvents(id);
      if (cancelled) return;

      setGame(local);
      setEvents(stored);
      setRules(local.rules ?? DEFAULT_RULES);
      setNotice(leagueNotice);
      setRosterNote(importNote);
      setLineups({
        home: local.lineups.home ?? blankLineup("home"),
        away: local.lineups.away ?? blankLineup("away"),
      });
      setLoading(false);
    }

    void load().catch(() => {
      if (!cancelled) {
        setLoadError("No pudimos abrir ese juego.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasStart = events.some((entry) => entry.event.type === "game.start");
  const hasLineups = events.some((entry) => entry.event.type === "lineup.set");
  const started = hasLineups;

  function loadRoster(side: "home" | "away"): void {
    if (!game?.rosters) return;

    const result = rosterToLineup(game.rosters[side], side, rules);
    const lineup = result.lineup;
    if (!lineup) {
      setRosterErrors((current) => ({ ...current, [side]: result.error }));
      return;
    }

    setLineups((current) =>
      current ? { ...current, [side]: lineup } : current,
    );
    setErrors((current) => ({ ...current, [side]: [] }));
    setRosterErrors((current) => ({ ...current, [side]: null }));
  }

  async function saveAndStart(): Promise<void> {
    if (!game || !lineups) return;

    const nextRulesErrors = validateRules(rules);
    const homeErrors = lineupStartErrors(lineups.home, game.homeTeam, rules);
    const awayErrors = lineupStartErrors(lineups.away, game.awayTeam, rules);
    const rosterErrors = rosterStartErrors(game);
    setRulesErrors(nextRulesErrors);
    setErrors({ home: homeErrors, away: awayErrors });
    if (
      nextRulesErrors.length > 0 ||
      rosterErrors.length > 0 ||
      homeErrors.length > 0 ||
      awayErrors.length > 0
    ) {
      setSaveError(
        rosterErrors[0] ?? "Revisa las reglas y las alineaciones marcadas.",
      );
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const store = localStore();
      const updated: LocalGame = {
        ...game,
        lineups: { home: lineups.home, away: lineups.away },
        rules,
      };
      await store.putGame(updated);

      const lastSeq = events.reduce((max, entry) => Math.max(max, entry.localSeq), -1);
      const nextSeq = lastSeq + 1;

      if (!hasStart) {
        for (const event of buildStartEvents(updated, lineups, nextSeq)) {
          await store.appendEvent(game.id, event);
        }
      } else if (!hasLineups) {
        for (const event of buildLineupEvents(updated, lineups, nextSeq)) {
          await store.appendEvent(game.id, event);
        }
      }

      router.push(`/score/${game.id}/score`);
    } catch (caught) {
      setSaveError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos guardar las alineaciones. Inténtalo de nuevo.",
      );
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScorerShell title="Juego" backHref="/score" gameId={id || undefined}>
        <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
          Abriendo el juego…
        </p>
      </ScorerShell>
    );
  }

  if (loadError || !game || !lineups) {
    return (
      <ScorerShell title="Juego" backHref="/score" gameId={id || undefined}>
        <div className="border border-line-strong bg-raised px-space-md py-space-md">
          <p className="font-display text-headline-sm text-ink">
            {loadError ?? "No encontramos ese juego."}
          </p>
          <Link
            href="/score"
            className="mt-space-md inline-flex min-h-12 items-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent"
          >
            Volver al inicio
          </Link>
        </div>
      </ScorerShell>
    );
  }

  const status = localGameStatus(game, events);
  const date = formatGameDate(game.scheduledStart);
  const meta = [game.venue, date].filter(Boolean).join(" · ");

  if (user && !hasScoringRole(memberships)) {
    return (
      <ScorerShell
        title={`${game.awayTeam} @ ${game.homeTeam}`}
        subtitle={meta || undefined}
        backHref="/score"
        gameId={game.id}
        hideSync
        actions={
          <span className="inline-flex min-h-12 items-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink-muted">
            {status}
          </span>
        }
      >
        <ReadOnlyPanel
          gameId={game.id}
          memberships={memberships}
          statusLabel={status}
        />
      </ScorerShell>
    );
  }

  const rosterReasons = rosterStartErrors(game);

  return (
    <ScorerShell
      title={`${game.awayTeam} @ ${game.homeTeam}`}
      subtitle={meta || undefined}
      backHref="/score"
      gameId={game.id}
      actions={
        <span className="inline-flex min-h-12 items-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink-muted">
          {status}
        </span>
      }
    >
      <div className="space-y-space-lg">
        {notice ? (
          <p
            role="status"
            className="border border-line bg-surface-low px-space-md py-space-sm font-body text-body-sm text-ink-muted"
          >
            {notice}
          </p>
        ) : null}

        {rosterNote ? (
          <p
            role="status"
            className="border-l-4 border-gold bg-surface-low px-space-sm py-space-sm font-body text-body-sm text-ink"
          >
            {rosterNote}
          </p>
        ) : null}

        {started ? (
          <section className="border border-line-strong bg-raised px-space-md py-space-md">
            <h2 className="font-display text-headline-sm text-ink">Juego iniciado</h2>
            <p className="mt-space-xs font-body text-body-md text-ink-muted">
              Las alineaciones ya quedaron registradas. La anotación en vivo llega en la
              siguiente entrega.
            </p>
            <Link
              href={`/score/${game.id}/score`}
              className="mt-space-md inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band"
            >
              Ir a anotar
            </Link>
          </section>
        ) : (
          <p className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-sm text-ink">
            Carga las dos alineaciones. El juego empieza con el equipo visitante al bate.
          </p>
        )}

        {hasStart ? <VerifierLink gameId={game.id} /> : null}

        <RulesCard
          rules={rules}
          onChange={setRules}
          errors={rulesErrors}
          disabled={events.length > 0}
        />

        <LineupEditor
          title={`Visitante · ${game.awayTeam}`}
          lineup={lineups.away}
          errors={errors.away}
          disabled={started}
          roster={game.rosters?.away}
          onLoadRoster={game.rosters ? () => loadRoster("away") : undefined}
          rosterError={rosterErrors.away}
          onChange={(lineup) => setLineups((current) => (current ? { ...current, away: lineup } : current))}
        />

        <LineupEditor
          title={`Local · ${game.homeTeam}`}
          lineup={lineups.home}
          errors={errors.home}
          disabled={started}
          roster={game.rosters?.home}
          onLoadRoster={game.rosters ? () => loadRoster("home") : undefined}
          rosterError={rosterErrors.home}
          onChange={(lineup) => setLineups((current) => (current ? { ...current, home: lineup } : current))}
        />

        {saveError ? (
          <p
            role="alert"
            className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-md text-ink"
          >
            {saveError}
          </p>
        ) : null}

        {rosterReasons.length > 0 ? (
          <div
            role="status"
            className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm"
          >
            {rosterReasons.map((reason) => (
              <p key={reason} className="font-body text-body-sm text-ink">
                {reason}
              </p>
            ))}
          </div>
        ) : null}

        {!started ? (
          <button
            type="button"
            onClick={() => void saveAndStart()}
            disabled={saving || rosterReasons.length > 0}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar y empezar"}
          </button>
        ) : null}
      </div>
    </ScorerShell>
  );
}
