"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CourtesyRunnerSheet } from "@/components/scorer/courtesy-runner-sheet";
import { useAuth } from "@/components/scorer/auth-provider";
import { ReadOnlyPanel } from "@/components/scorer/read-only-panel";
import { EjectionSheet, type EjectionSelection } from "@/components/scorer/ejection-sheet";
import { OutcomePad } from "@/components/scorer/outcome-pad";
import { PitchPad } from "@/components/scorer/pitch-pad";
import { ProposalInbox } from "@/components/scorer/proposal-inbox";
import { MobilePublicPreview, PublicPreview } from "@/components/scorer/public-preview";
import { RunnerSheet, type RunnerAction } from "@/components/scorer/runner-sheet";
import { Scoreboard } from "@/components/scorer/scoreboard";
import { ScorerShell } from "@/components/scorer/scorer-shell";
import {
  SubstitutionSheet,
  type SubstitutionSelection,
} from "@/components/scorer/substitution-sheet";
import { VerifierLink } from "@/components/scorer/verifier-link";
import type { Event } from "@olb/contract/types";
import { VIEWER_URL } from "@/lib/scorer/config";
import {
  ballInPlay,
  ejection,
  gameResume,
  gameSuspend,
  inningEnd,
  interference,
  note,
  pitch,
  runner,
  substitution,
} from "@/lib/scorer/events";
import type { PitchPayload } from "@olb/contract/types";
import type { GameState } from "@/lib/scorer/fold";
import type { FinishReason } from "@/lib/scorer/finish";
import { finishExplanation, finishMode, finishTitle } from "@/lib/scorer/finish";
import type { ProposalPayload } from "@/lib/scorer/api";
import { batterAt } from "@/lib/scorer/lineup";
import { hasScoringRole } from "@/lib/scorer/roles";
import { localStore } from "@/lib/scorer/store";
import { uuid7 } from "@/lib/scorer/uuid7";
import {
  courtesyRunnerOptions,
  DEFAULT_RULES,
  mercyReached,
  pitchCount,
  placedRunnerEligible,
  regulationComplete,
  type RulesProfile,
} from "@/lib/scorer/rules";
import {
  nextPitchNo,
  outcome,
  outsAdded,
  runsThisHalf,
  type OutcomeCode,
} from "@/lib/scorer/scoring";
import { useGame } from "@/lib/scorer/use-game";
import type { StoredEvent } from "@/lib/scorer/types";

type PitchCall = Extract<PitchPayload["call"], "B" | "C" | "S" | "F" | "T" | "H" | "I">;

function renumber(events: readonly StoredEvent[]): Event[] {
  return events.map(({ localSeq, event }) => ({ ...event, seq: localSeq }));
}

function isFinished(status: string): boolean {
  return status === "final" || status === "forfeit";
}

type EndBanner =
  | { kind: "mercy"; runs: number; afterInning: number }
  | { kind: "regulation" };

/** What the inning end just triggered. Mercy wins when both rules apply. */
function bannerFor(state: GameState, rules: RulesProfile): EndBanner | null {
  if (mercyReached(state, rules)) {
    return { kind: "mercy", runs: rules.mercy.runs, afterInning: rules.mercy.afterInning };
  }
  if (regulationComplete(state, rules)) return { kind: "regulation" };
  return null;
}

const actionButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-50";

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band";

const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-lg font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent";

export default function ScorePage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const router = useRouter();
  const { user, memberships } = useAuth();

  const {
    game,
    events,
    state,
    loading,
    busy,
    error,
    hasSetup,
    pending,
    recovered,
    recoveryNote,
    battingLineup,
    fieldingLineup,
    batter,
    pitcher,
    plateAppearances,
    canUndo,
    append,
    undo,
    finish,
    reload,
  } = useGame(id);

  const [showOutcomes, setShowOutcomes] = useState(false);
  const [showCourtesy, setShowCourtesy] = useState(false);
  const [showRunner, setShowRunner] = useState(false);
  const [showSubstitution, setShowSubstitution] = useState(false);
  const [showEjection, setShowEjection] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [showRecoveryNote, setShowRecoveryNote] = useState(true);
  const [acting, setActing] = useState(false);
  const [endBanner, setEndBanner] = useState<EndBanner | null>(null);

  useEffect(() => {
    if (!loading && game && !hasSetup) {
      router.replace(`/score/${game.id}`);
    }
  }, [game, hasSetup, loading, router]);

  const working = busy || acting;
  const rules = game?.rules ?? DEFAULT_RULES;
  const applied = useMemo(() => renumber(events), [events]);
  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (!game) return map;
    for (const side of ["away", "home"] as const) {
      for (const player of game.lineups[side]?.players ?? []) {
        map[player.id] = player.name;
      }
    }
    return map;
  }, [game]);
  const pitcherPitches = useMemo(
    () => (pitcher ? pitchCount(applied, pitcher.id) : 0),
    [applied, pitcher],
  );
  const pitchLimitReached =
    rules.pitchLimit !== null && pitcherPitches >= rules.pitchLimit;
  const previousBatter =
    battingLineup && plateAppearances > 0
      ? batterAt(battingLineup, plateAppearances - 1)
      : null;
  const canPlaceRunner =
    state !== null && placedRunnerEligible(state, rules, applied);
  const courtesyOptions =
    state && battingLineup
      ? courtesyRunnerOptions(state, battingLineup, batter?.id ?? null)
      : [];
  const canUseCourtesy = rules.courtesyRunner && courtesyOptions.length > 0;

  function playerName(playerId: string): string {
    if (!game) return "Jugador";
    for (const side of ["away", "home"] as const) {
      const player = game.lineups[side]?.players.find((entry) => entry.id === playerId);
      if (player) return player.name;
    }
    return "Jugador";
  }

  /**
   * Appends the automatic inning end when the play just recorded was the third
   * out. The fold never advances the half on its own.
   */
  async function closeHalfIfNeeded(
    snapshot: Awaited<ReturnType<typeof append>>,
    before: GameState,
    added: number,
  ): Promise<void> {
    if (!snapshot || before.outs + added < 3) return;
    const runs = runsThisHalf(renumber(snapshot.events), snapshot.state);
    const ended = await append(
      inningEnd(id, 0, {
        inning: before.inning,
        half: before.half,
        runsScored: runs,
        outs: 3,
      }),
    );
    if (ended) setEndBanner(bannerFor(ended.state, rules));
  }

  async function recordPitch(call: PitchCall): Promise<boolean> {
    if (!state || !batter || !pitcher) return false;
    setActing(true);
    setEndBanner(null);

    try {
      const event = pitch(id, 0, {
        pitchNo: nextPitchNo(applied),
        batter: batter.id,
        pitcher: pitcher.id,
        count: { ...state.count },
        call,
      });
      const added = outsAdded(state, event);
      const snapshot = await append(event);
      if (!snapshot) return false;
      await closeHalfIfNeeded(snapshot, state, added);
      return true;
    } finally {
      setActing(false);
    }
  }

  async function recordOutcome(code: OutcomeCode): Promise<boolean> {
    if (!state || !batter) return false;
    setActing(true);
    setEndBanner(null);

    try {
      const announced = pitch(id, 0, {
        pitchNo: nextPitchNo(applied),
        batter: batter.id,
        pitcher: pitcher?.id ?? "",
        count: { ...state.count },
        call: "X",
      });
      if (!(await append(announced))) return false;

      const payload = outcome(state, code, batter, fieldingLineup?.players ?? []);
      const added = outsAdded(state, ballInPlay(id, 0, payload));
      const snapshot = await append(ballInPlay(id, 0, payload));
      setShowOutcomes(false);
      if (!snapshot) return false;
      await closeHalfIfNeeded(snapshot, state, added);
      return true;
    } finally {
      setActing(false);
    }
  }

  /** Applies an accepted proposal through the same append path as a tap. */
  async function acceptProposal(payload: ProposalPayload): Promise<boolean> {
    return payload.kind === "pitch"
      ? recordPitch(payload.call)
      : recordOutcome(payload.code);
  }

  async function handleUndo(): Promise<void> {
    setActing(true);
    setShowOutcomes(false);
    setShowCourtesy(false);
    setShowRunner(false);
    setShowSubstitution(false);
    setShowEjection(false);
    setEndBanner(null);
    try {
      await undo();
    } finally {
      setActing(false);
    }
  }

  async function placeAutomaticRunner(): Promise<void> {
    if (!state || !previousBatter) return;
    setActing(true);
    try {
      const placed = await append(
        runner(id, 0, {
          player: previousBatter.id,
          from: "bench",
          to: "2",
          kind: "placed",
          out: false,
        }),
      );
      if (!placed) return;
      await append(note(id, 0, { text: "Corredor automático (extra innings)" }));
    } finally {
      setActing(false);
    }
  }

  async function placeCourtesyRunner(
    from: "1" | "2" | "3",
    replacementId: string,
  ): Promise<void> {
    if (!state) return;
    setActing(true);
    try {
      const replaced = await append(
        runner(id, 0, {
          player: replacementId,
          from,
          to: from,
          kind: "other",
          out: false,
        }),
      );
      if (!replaced) return;
      await append(note(id, 0, { text: `Corredor cortés en ${from}.ª base` }));
      setShowCourtesy(false);
    } finally {
      setActing(false);
    }
  }

  async function recordRunner(action: RunnerAction): Promise<void> {
    if (!state) return;
    setActing(true);
    setEndBanner(null);

    try {
      const to =
        action.action === "pickoff"
          ? action.from
          : action.from === "1"
            ? "2"
            : action.from === "2"
              ? "3"
              : "H";
      const out =
        action.action === "caught_stealing" || action.action === "pickoff";
      const event = runner(id, 0, {
        player: action.player,
        from: action.from,
        to,
        kind: action.action,
        out,
      });
      const added = outsAdded(state, event);
      const snapshot = await append(event);
      if (!snapshot) return;
      setShowRunner(false);
      await closeHalfIfNeeded(snapshot, state, added);
    } finally {
      setActing(false);
    }
  }

  async function recordInterference(): Promise<void> {
    if (!state || !batter) return;
    setActing(true);
    setEndBanner(null);
    try {
      await append(
        interference(id, 0, {
          batter: batter.id,
          kind: "catcher",
          description: "Interferencia del receptor",
        }),
      );
    } finally {
      setActing(false);
    }
  }

  async function handleSubstitute(selection: SubstitutionSelection): Promise<void> {
    setActing(true);
    try {
      const playerInId = selection.playerInId ?? uuid7();
      const snapshot = await append(
        substitution(id, 0, {
          team: selection.team,
          playerIn: playerInId,
          playerOut: selection.playerOut.id,
          position: selection.position,
          battingSlot: selection.playerOut.battingSlot,
          reason: selection.reason,
          ...(selection.reason === "reentry" ? { reentry: true } : {}),
        }),
      );
      if (!snapshot) return;

      const current = snapshot.game;
      const sideLineup = current.lineups[selection.team];
      if (sideLineup) {
        const players = sideLineup.players.map((player) =>
          player.id === selection.playerOut.id
            ? {
                ...player,
                id: playerInId,
                name: selection.playerInName,
                position: selection.position,
              }
            : player,
        );
        await localStore().putGame({
          ...current,
          lineups: {
            ...current.lineups,
            [selection.team]: {
              ...sideLineup,
              players,
              pitcherId:
                selection.position === "1" ? playerInId : sideLineup.pitcherId,
            },
          },
        });
        await reload();
      }
      setShowSubstitution(false);
    } finally {
      setActing(false);
    }
  }

  async function handleSuspend(): Promise<void> {
    setActing(true);
    setEndBanner(null);
    try {
      await append(
        gameSuspend(id, 0, { reason: "Suspensión registrada por el anotador" }),
      );
      setConfirmFinish(false);
    } finally {
      setActing(false);
    }
  }

  async function handleResume(): Promise<void> {
    setActing(true);
    setEndBanner(null);
    try {
      await append(gameResume(id, 0));
    } finally {
      setActing(false);
    }
  }

  async function handleEject(selection: EjectionSelection): Promise<void> {
    setActing(true);
    try {
      const ejected = await append(
        ejection(id, 0, {
          person: selection.personId ?? uuid7(),
          role: selection.role,
          reason: selection.reason,
        }),
      );
      if (ejected) {
        await append(
          note(id, 0, {
            text: `Expulsión: ${selection.personName} — ${selection.reason}`,
          }),
        );
      }
      setShowEjection(false);
    } finally {
      setActing(false);
    }
  }

  async function handleFinish(reason: FinishReason): Promise<void> {
    setActing(true);
    try {
      const snapshot = await finish(reason);
      if (snapshot) setConfirmFinish(false);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <ScorerShell title="Anotar" backHref={id ? `/score/${id}` : "/score"} gameId={id || undefined}>
        <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
          Abriendo el juego…
        </p>
      </ScorerShell>
    );
  }

  if (!game || !state) {
    return (
      <ScorerShell title="Anotar" backHref="/score" gameId={id || undefined}>
        <div className="border border-line-strong bg-raised px-space-md py-space-md">
          <p className="font-display text-headline-sm text-ink">
            {error ?? "No encontramos ese juego."}
          </p>
          <Link href="/score" className={`${secondaryButton} mt-space-md`}>
            Volver al inicio
          </Link>
        </div>
      </ScorerShell>
    );
  }

  if (!hasSetup) {
    return (
      <ScorerShell
        title={`${game.awayTeam} @ ${game.homeTeam}`}
        backHref={`/score/${game.id}`}
        gameId={game.id}
      >
        <p className="border border-line bg-raised px-space-md py-space-md font-body text-body-md text-ink-muted">
          Este juego todavía no tiene alineaciones. Abriendo la preparación…
        </p>
      </ScorerShell>
    );
  }

  if (user && !hasScoringRole(memberships)) {
    const statusLabel = isFinished(state.status)
      ? state.status === "forfeit"
        ? "Juego forfeit"
        : "Final"
      : state.status === "suspended"
        ? "Juego suspendido"
        : `Entrada ${state.inning} · ${state.half === "top" ? "Alta" : "Baja"}`;

    return (
      <ScorerShell
        title={`${game.awayTeam} @ ${game.homeTeam}`}
        backHref={`/score/${game.id}`}
        backLabel="Juego"
        gameId={game.id}
        hideSync
      >
        <ReadOnlyPanel
          gameId={game.id}
          memberships={memberships}
          pendingPlays={pending}
          scoreline={`${game.awayTeam} ${state.score.away} — ${state.score.home} ${game.homeTeam}`}
          statusLabel={statusLabel}
        />
      </ScorerShell>
    );
  }

  const half = state.half === "top" ? "Alta" : "Baja";
  const finished = isFinished(state.status);
  const suspended = state.status === "suspended";
  const closing = finishMode(state);
  const hasStart = events.some((entry) => entry.event.type === "game.start");
  const subtitle = finished
    ? "Final"
    : suspended
      ? "Suspendido"
      : `Entrada ${state.inning} · ${half}`;

  const actions = finished ? undefined : (
    <>
      {suspended ? (
        <button
          type="button"
          className={actionButton}
          onClick={() => void handleResume()}
          disabled={working}
        >
          Reanudar
        </button>
      ) : (
        <>
          <button
            type="button"
            className={actionButton}
            onClick={() => setConfirmFinish(true)}
            disabled={working}
          >
            Finalizar
          </button>
          <button
            type="button"
            className={actionButton}
            onClick={() => void handleSuspend()}
            disabled={working}
          >
            Suspender
          </button>
        </>
      )}
      <button
        type="button"
        className={actionButton}
        onClick={() => {
          setShowEjection((current) => !current);
          setShowSubstitution(false);
          setShowRunner(false);
        }}
        disabled={working}
      >
        Expulsar
      </button>
    </>
  );

  const previewProps = {
    gameId: game.id,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    state,
    events: applied,
    names: playerNames,
    batter: batter?.name ?? null,
    pitcher: pitcher?.name ?? null,
    pending,
  };
  const preview = <PublicPreview {...previewProps} />;
  const mobilePreview = <MobilePublicPreview {...previewProps} />;

  return (
    <ScorerShell
      title={`${game.awayTeam} @ ${game.homeTeam}`}
      subtitle={subtitle}
      backHref={`/score/${game.id}`}
      backLabel="Juego"
      actions={actions}
      gameId={game.id}
      wide
    >
      <div className="grid gap-space-md xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-space-lg">
        <div className="min-w-0 space-y-space-md">
          {recoveryNote && showRecoveryNote ? (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-space-sm border-l-4 border-gold bg-surface-low px-space-sm py-space-sm"
            >
              <p className="font-body text-body-sm text-ink">
                {recoveryNote}
                {recovered > 0
                  ? " · Ya están en este dispositivo."
                  : null}
              </p>
              <button
                type="button"
                onClick={() => setShowRecoveryNote(false)}
                className={secondaryButton}
              >
                Cerrar
              </button>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-md text-ink"
            >
              {error}
            </p>
          ) : null}

          {finished ? (
            <>
              <FinalCard
                awayTeam={game.awayTeam}
                homeTeam={game.homeTeam}
                awayScore={state.score.away}
                homeScore={state.score.home}
                gameId={game.id}
                status={state.status}
              />
              {mobilePreview}
            </>
          ) : (
            <>
              {hasStart ? <VerifierLink gameId={game.id} /> : null}

              <ProposalInbox
                gameId={game.id}
                onAccept={acceptProposal}
                disabled={working || suspended}
              />

              <Scoreboard
                state={state}
                awayTeam={game.awayTeam}
                homeTeam={game.homeTeam}
                batter={batter?.name ?? null}
                pitcher={pitcher?.name ?? null}
                pitcherPitches={pitcherPitches}
                pitchLimit={rules.pitchLimit}
              />

              {mobilePreview}

              {suspended ? (
                <section className="border border-line-strong bg-raised px-space-md py-space-md">
                  <p className="font-label-caps text-label-caps uppercase text-accent">
                    Juego suspendido
                  </p>
                  <p className="mt-space-xs font-body text-body-md text-ink-muted">
                    Reanuda el juego para seguir anotando desde donde quedó.
                  </p>
                  <button
                    type="button"
                    className={`${primaryButton} mt-space-md`}
                    onClick={() => void handleResume()}
                    disabled={working}
                  >
                    Reanudar
                  </button>
                </section>
              ) : (
                <>
                  {confirmFinish ? (
                    <section className="border border-line-strong bg-raised px-space-md py-space-md">
                      <p className="font-label-caps text-label-caps uppercase text-accent">
                        {finishTitle(closing)}
                      </p>
                      <p className="mt-space-xs font-display text-headline-sm text-ink">
                        {game.awayTeam} {state.score.away} — {state.score.home} {game.homeTeam}
                      </p>
                      <p className="mt-space-xs font-body text-body-sm text-ink-muted">
                        Entrada {state.inning} · {half}
                      </p>
                      <p className="mt-space-xs font-body text-body-md text-ink-muted">
                        {finishExplanation(state, closing)}
                      </p>
                      <div className="mt-space-md flex flex-wrap gap-space-sm">
                        {closing === "completed" ? (
                          <>
                            <button
                              type="button"
                              className={primaryButton}
                              onClick={() => void handleFinish("completed")}
                              disabled={working}
                            >
                              Sí, finalizar
                            </button>
                            <button
                              type="button"
                              className={secondaryButton}
                              onClick={() => setConfirmFinish(false)}
                              disabled={working}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : closing === "shortened" ? (
                          <>
                            <button
                              type="button"
                              className={primaryButton}
                              onClick={() => void handleFinish("shortened")}
                              disabled={working}
                            >
                              Finalizar como juego corto
                            </button>
                            <button
                              type="button"
                              className={secondaryButton}
                              onClick={() => setConfirmFinish(false)}
                              disabled={working}
                            >
                              Seguir anotando
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={secondaryButton}
                            onClick={() => setConfirmFinish(false)}
                            disabled={working}
                          >
                            Volver
                          </button>
                        )}
                      </div>
                    </section>
                  ) : null}

                  {pitchLimitReached ? (
                    <p
                      role="status"
                      className="border-l-4 border-gold bg-surface-low px-space-sm py-space-sm font-body text-body-md text-ink"
                    >
                      Límite de lanzamientos alcanzado ({rules.pitchLimit})
                    </p>
                  ) : null}

                  {endBanner ? (
                    <section className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm">
                      <p className="font-display text-headline-sm text-ink">
                        {endBanner.kind === "mercy"
                          ? `Misericordia: ${endBanner.runs} carreras desde la ${endBanner.afterInning}.ª`
                          : "Regulación completa"}
                      </p>
                      <div className="mt-space-sm flex flex-wrap gap-space-sm">
                        <button
                          type="button"
                          className={primaryButton}
                          onClick={() => setConfirmFinish(true)}
                          disabled={working}
                        >
                          Finalizar
                        </button>
                        <button
                          type="button"
                          className={secondaryButton}
                          onClick={() => setEndBanner(null)}
                          disabled={working}
                        >
                          Seguir
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {canPlaceRunner ? (
                    <button
                      type="button"
                      className={`${secondaryButton} w-full`}
                      onClick={() => void placeAutomaticRunner()}
                      disabled={working || !previousBatter}
                    >
                      Colocar corredor automático en 2.ª
                    </button>
                  ) : null}

                  {canUseCourtesy ? (
                    <button
                      type="button"
                      className={`${secondaryButton} w-full`}
                      onClick={() => setShowCourtesy((current) => !current)}
                      disabled={working}
                    >
                      Corredor cortés
                    </button>
                  ) : null}

                  {showCourtesy && canUseCourtesy ? (
                    <CourtesyRunnerSheet
                      options={courtesyOptions}
                      onSelect={(from, replacementId) =>
                        void placeCourtesyRunner(from, replacementId)
                      }
                      onCancel={() => setShowCourtesy(false)}
                      disabled={working}
                    />
                  ) : null}

                  <div className="grid gap-space-sm sm:grid-cols-2">
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => {
                        setShowRunner((current) => !current);
                        setShowSubstitution(false);
                        setShowOutcomes(false);
                        setShowEjection(false);
                      }}
                      disabled={working}
                    >
                      Robo / corredor
                    </button>
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => {
                        setShowSubstitution((current) => !current);
                        setShowRunner(false);
                        setShowOutcomes(false);
                        setShowEjection(false);
                      }}
                      disabled={working}
                    >
                      Cambio
                    </button>
                    <button
                      type="button"
                      className={`${secondaryButton} sm:col-span-2`}
                      onClick={() => void recordInterference()}
                      disabled={working || !batter}
                    >
                      Interferencia
                    </button>
                  </div>

                  {showRunner ? (
                    <RunnerSheet
                      bases={state.bases}
                      playerName={playerName}
                      onAction={(action) => void recordRunner(action)}
                      onCancel={() => setShowRunner(false)}
                      disabled={working}
                    />
                  ) : null}

                  {showSubstitution ? (
                    <SubstitutionSheet
                      teams={{ home: game.homeTeam, away: game.awayTeam }}
                      lineups={game.lineups}
                      rosters={game.rosters}
                      onSubstitute={(selection) => void handleSubstitute(selection)}
                      onCancel={() => setShowSubstitution(false)}
                      disabled={working}
                    />
                  ) : null}

                  {showOutcomes ? (
                    <OutcomePad
                      onSelect={(code) => void recordOutcome(code)}
                      onCancel={() => setShowOutcomes(false)}
                      disabled={working}
                    />
                  ) : (
                    <PitchPad
                      onPitch={(call) => void recordPitch(call)}
                      onInPlay={() => {
                        setShowOutcomes(true);
                        setShowRunner(false);
                        setShowSubstitution(false);
                      }}
                      disabled={working || !batter || !pitcher}
                    />
                  )}

                  <button
                    type="button"
                    className={`${secondaryButton} w-full`}
                    onClick={() => void handleUndo()}
                    disabled={!canUndo || working}
                  >
                    Deshacer
                  </button>

                  <p className="font-body text-body-sm text-ink-muted">
                    Cada toque se guarda en este dispositivo al instante. La barra superior
                    sube las jugadas pendientes cuando hay conexión.
                  </p>
                </>
              )}

              {showEjection ? (
                <EjectionSheet
                  teams={{ home: game.homeTeam, away: game.awayTeam }}
                  lineups={game.lineups}
                  onEject={(selection) => void handleEject(selection)}
                  onCancel={() => setShowEjection(false)}
                  disabled={working}
                />
              ) : null}
            </>
          )}
        </div>
        <aside className="sticky top-space-md hidden self-start xl:block">
          {preview}
        </aside>
      </div>
    </ScorerShell>
  );
}

interface FinalCardProps {
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  gameId: string;
  status: string;
}

function FinalCard({
  awayTeam,
  homeTeam,
  awayScore,
  homeScore,
  gameId,
  status,
}: FinalCardProps) {
  return (
    <section className="border border-line-strong bg-raised px-space-md py-space-lg text-center">
      <p className="font-label-caps text-label-caps uppercase text-accent">
        {status === "forfeit" ? "Juego forfeit" : status === "suspended" ? "Juego suspendido" : "Final"}
      </p>
      <h2 className="mt-space-xs font-display text-headline-lg-mobile text-ink">
        {awayTeam} {awayScore} — {homeScore} {homeTeam}
      </h2>
      <p className="mt-space-sm font-body text-body-md text-ink-muted">
        El juego quedó cerrado en este dispositivo.
      </p>
      <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
        <Link href="/score" className={primaryButton}>
          Volver al inicio
        </Link>
        <a href={`${VIEWER_URL}/score/${gameId}`} className={secondaryButton}>
          Ver en el visor
        </a>
      </div>
    </section>
  );
}
