"use client";

import { parseEvent } from "@olb/contract";
import type { Event } from "@olb/contract/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { foldStored } from "./db";
import { gameEnd, voidEvent } from "./events";
import type { FinishReason } from "./finish";
import { type GameState, type TeamSide } from "./fold";
import { batterAt, fielderAt } from "./lineup";
import { recoverGame } from "./recovery";
import {
  canUndo as canUndoEvents,
  countPlateAppearances,
  undoTargets,
} from "./scoring";
import { localStore } from "./store";
import { syncGame } from "./sync";
import type { Lineup, LocalGame, StoredEvent } from "./types";

export interface GameSnapshot {
  game: LocalGame;
  events: StoredEvent[];
  state: GameState;
  pending: number;
}

function renumber(events: readonly StoredEvent[]): Event[] {
  return events.map(({ localSeq, event }) => ({ ...event, seq: localSeq }));
}

function messageFor(caught: unknown): string {
  if (caught instanceof Error && caught.message.trim() !== "") {
    return caught.message;
  }
  return "No pudimos guardar la jugada. Inténtalo de nuevo.";
}

async function readSnapshot(gameId: string): Promise<GameSnapshot | null> {
  const store = localStore();
  const game = await store.getGame(gameId);
  if (!game) return null;

  const events = await store.listEvents(gameId);
  const pending = (await store.pendingEvents(gameId)).length;
  return { game, events, state: foldStored(events), pending };
}

/**
 * The live game the scoring screen works from. Every write goes to the local
 * append-only log first; the projection is always re-folded from IndexedDB,
 * so a reload and a fresh tap see the same state.
 */
export function useGame(gameId: string) {
  const [game, setGame] = useState<LocalGame | null>(null);
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const commit = useCallback((snapshot: GameSnapshot) => {
    if (!mounted.current) return;
    setGame(snapshot.game);
    setEvents(snapshot.events);
    setState(snapshot.state);
    setPending(snapshot.pending);
  }, []);

  const reload = useCallback(async (): Promise<GameSnapshot | null> => {
    if (!gameId) return null;
    const snapshot = await readSnapshot(gameId);
    if (snapshot) commit(snapshot);
    return snapshot;
  }, [commit, gameId]);

  // A sync drain marks events as synced outside this hook. Re-read the local
  // snapshot so `pending`, the outbox status and the public preview agree.
  useEffect(() => {
    const handleSync = () => {
      void reload();
    };
    window.addEventListener("olb-sync-complete", handleSync);
    return () => window.removeEventListener("olb-sync-complete", handleSync);
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRecovered(0);

    void (async () => {
      let recoveryError: string | null = null;

      try {
        if (!gameId) {
          if (!cancelled) setError("No encontramos ese juego.");
          return;
        }

        const local = await readSnapshot(gameId);
        if (!local || local.events.length === 0) {
          try {
            const recovery = await recoverGame(gameId);
            if (!cancelled && recovery.imported > 0) {
              setRecovered(recovery.imported);
            }
          } catch (caught) {
            recoveryError =
              caught instanceof Error && caught.message.trim() !== ""
                ? caught.message
                : "No pudimos recuperar el juego del servidor.";
          }
        }

        const snapshot = await readSnapshot(gameId);
        if (cancelled) return;
        if (!snapshot) {
          setError(recoveryError ?? "No encontramos ese juego.");
          return;
        }
        commit(snapshot);
        setError(recoveryError);
      } catch {
        if (!cancelled) setError("No pudimos abrir el juego en este dispositivo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commit, gameId]);

  const append = useCallback(
    async (event: Event): Promise<GameSnapshot | null> => {
      if (!gameId) return null;
      setBusy(true);
      setError(null);

      try {
        const store = localStore();
        const current = await store.listEvents(gameId);
        const next = current.reduce((max, entry) => Math.max(max, entry.localSeq), -1) + 1;
        const parsed = parseEvent({ ...event, seq: next });
        await store.appendEvent(gameId, parsed);
        const snapshot = await readSnapshot(gameId);
        if (snapshot) {
          commit(snapshot);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("olb-local-change"));
          }
        }
        return snapshot;
      } catch (caught) {
        if (mounted.current) setError(messageFor(caught));
        return null;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [commit, gameId],
  );

  const undo = useCallback(async (): Promise<GameSnapshot | null> => {
    if (!gameId) return null;
    try {
      const store = localStore();
      const current = await store.listEvents(gameId);
      const targets = undoTargets(renumber(current));
      if (targets.length === 0) return null;

      let snapshot: GameSnapshot | null = null;
      for (const target of targets) {
        snapshot = await append(
          voidEvent(
            gameId,
            target.seq,
            { id: target.id, seq: target.seq },
            "data_entry",
          ),
        );
        if (!snapshot) return null;
      }
      return snapshot;
    } catch (caught) {
      if (mounted.current) setError(messageFor(caught));
      return null;
    }
  }, [append, gameId]);

  const finish = useCallback(
    async (reason: FinishReason = "completed"): Promise<GameSnapshot | null> => {
      if (!gameId) return null;
      try {
        const snapshot = await readSnapshot(gameId);
        if (!snapshot) {
          setError("No encontramos ese juego.");
          return null;
        }

        const appended = await append(
          gameEnd(gameId, 0, {
            reason,
            finalScore: { ...snapshot.state.score },
          }),
        );
        if (!appended) return null;

        // The API re-validates the reason against the same rules. Pushing the
        // outbox now surfaces a rejection (a race with another device, for
        // example) instead of leaving the game final without a word. Offline
        // the append stays pending, as every other play does.
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          try {
            const result = await syncGame(localStore(), gameId);
            if (result.error && !result.offline) {
              if (mounted.current) setError(result.error);
              return null;
            }
          } catch (caught) {
            if (mounted.current) setError(messageFor(caught));
            return null;
          }
        }

        return appended;
      } catch (caught) {
        if (mounted.current) setError(messageFor(caught));
        return null;
      }
    },
    [append, gameId],
  );

  const plateAppearances = useMemo(
    () => countPlateAppearances(renumber(events)),
    [events],
  );

  const battingSide: TeamSide = state?.battingTeam ?? "away";
  const fieldingSide: TeamSide = battingSide === "home" ? "away" : "home";

  const battingLineup: Lineup | null = game
    ? battingSide === "home"
      ? game.lineups.home
      : game.lineups.away
    : null;
  const fieldingLineup: Lineup | null = game
    ? fieldingSide === "home"
      ? game.lineups.home
      : game.lineups.away
    : null;

  const batter = battingLineup ? batterAt(battingLineup, plateAppearances) : null;
  // With a DH the pitcher is not in the batting order, so the roster is the
  // only place that still has his name. The lineup keeps his id either way.
  const rosterPitcher =
    game?.rosters?.[fieldingSide]?.find(
      (player) => player.id === fieldingLineup?.pitcherId,
    ) ?? null;
  const pitcher = fieldingLineup
    ? (fieldingLineup.players.find((player) => player.id === fieldingLineup.pitcherId) ??
      fielderAt(fieldingLineup, "1") ??
      (rosterPitcher
        ? {
            id: rosterPitcher.id,
            name: rosterPitcher.name,
            position: "1" as const,
            battingSlot: 0,
          }
        : null))
    : null;

  const hasSetup =
    events.some((entry) => entry.event.type === "game.start") &&
    events.some((entry) => entry.event.type === "lineup.set");

  const recoveryNote =
    recovered > 0
      ? `Juego recuperado del servidor: ${recovered} ${
          recovered === 1 ? "jugada" : "jugadas"
        }`
      : null;

  return {
    game,
    events,
    state,
    pending,
    loading,
    busy,
    error,
    hasSetup,
    recovered,
    recoveryNote,
    battingLineup,
    fieldingLineup,
    batter,
    pitcher,
    plateAppearances,
    canUndo: canUndoEvents(renumber(events)),
    append,
    undo,
    finish,
    reload,
  };
}
