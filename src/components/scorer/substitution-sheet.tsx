"use client";

import { useState } from "react";
import type { SubstitutionPayload } from "@olb/contract/types";
import type {
  FieldingPosition,
  Lineup,
  Player,
  RosterPlayer,
  TeamSide,
} from "@/lib/scorer/types";

export type SubstitutionReason = NonNullable<SubstitutionPayload["reason"]>;

export interface SubstitutionSelection {
  team: TeamSide;
  playerOut: Player;
  playerInId: string | null;
  playerInName: string;
  position: FieldingPosition;
  reason: SubstitutionReason;
}

interface SubstitutionSheetProps {
  teams: { home: string; away: string };
  lineups: { home: Lineup | null; away: Lineup | null };
  rosters?: { home: RosterPlayer[]; away: RosterPlayer[] };
  onSubstitute: (selection: SubstitutionSelection) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const positions: Array<{ value: FieldingPosition; label: string }> = [
  { value: "1", label: "P" },
  { value: "2", label: "C" },
  { value: "3", label: "1B" },
  { value: "4", label: "2B" },
  { value: "5", label: "3B" },
  { value: "6", label: "SS" },
  { value: "7", label: "LF" },
  { value: "8", label: "CF" },
  { value: "9", label: "RF" },
  { value: "DH", label: "DH" },
  { value: "PH", label: "PH" },
  { value: "PR", label: "PR" },
];

const reasons: Array<{ value: SubstitutionReason; label: string }> = [
  { value: "tactical", label: "Táctica" },
  { value: "injury", label: "Lesión" },
  { value: "pitch_count", label: "Límite de lanzamientos" },
  { value: "courtesy", label: "Cortesía" },
  { value: "reentry", label: "Reingreso" },
  { value: "other", label: "Otra" },
];

const fieldClass =
  "mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink focus:border-accent disabled:bg-surface-low";
const labelClass = "block font-label-caps text-label-caps uppercase text-ink-muted";

function playerLabel(player: Player): string {
  return `${player.battingSlot}. ${player.name.trim() || "Sin nombre"} · ${player.position}`;
}

function rosterLabel(player: RosterPlayer): string {
  return [player.jersey ? `#${player.jersey}` : null, player.name, player.position]
    .filter(Boolean)
    .join(" · ");
}

/** Pick the player leaving, the player entering and the reason. */
export function SubstitutionSheet({
  teams,
  lineups,
  rosters,
  onSubstitute,
  onCancel,
  disabled = false,
}: SubstitutionSheetProps) {
  const [side, setSide] = useState<TeamSide>("away");
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");
  const [manualName, setManualName] = useState("");
  const [positionOverride, setPositionOverride] = useState<FieldingPosition | "">("");
  const [reason, setReason] = useState<SubstitutionReason>("tactical");

  const lineup = lineups[side];
  const playerOut =
    lineup?.players.find((player) => player.id === playerOutId) ??
    lineup?.players[0] ??
    null;

  const roster = rosters?.[side] ?? [];
  const inLineup = new Set(lineup?.players.map((player) => player.id) ?? []);
  const available = roster.filter((player) => !inLineup.has(player.id));
  const playerIn =
    available.find((player) => player.id === playerInId) ?? available[0] ?? null;
  const manual = playerInId === "__manual" || (!playerIn && manualName.trim() !== "");
  const position = positionOverride || playerOut?.position || "1";

  function changeSide(next: TeamSide): void {
    setSide(next);
    setPlayerOutId("");
    setPlayerInId("");
    setManualName("");
    setPositionOverride("");
  }

  function changePlayerOut(next: string): void {
    setPlayerOutId(next);
    const player = lineup?.players.find((entry) => entry.id === next);
    setPositionOverride(player?.position ?? "");
  }

  function submit(): void {
    if (!playerOut) return;
    const name = manual ? manualName.trim() : playerIn?.name.trim() ?? "";
    if (name === "") return;

    onSubstitute({
      team: side,
      playerOut,
      playerInId: manual ? null : playerIn?.id ?? null,
      playerInName: name,
      position,
      reason,
    });
  }

  return (
    <section className="border border-line-strong bg-surface-low p-space-sm">
      <p className="mb-space-sm font-label-caps text-label-caps uppercase text-ink-muted">
        Cambio de jugador
      </p>

      <div className="grid gap-space-sm sm:grid-cols-2">
        <label className={labelClass}>
          Equipo
          <select
            value={side}
            disabled={disabled}
            onChange={(event) => changeSide(event.target.value as TeamSide)}
            className={fieldClass}
          >
            <option value="away">Visitante · {teams.away}</option>
            <option value="home">Local · {teams.home}</option>
          </select>
        </label>

        <label className={labelClass}>
          Sale
          <select
            value={playerOut?.id ?? ""}
            disabled={disabled || !lineup}
            onChange={(event) => changePlayerOut(event.target.value)}
            className={fieldClass}
          >
            {lineup ? (
              lineup.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {playerLabel(player)}
                </option>
              ))
            ) : (
              <option value="">Sin alineación</option>
            )}
          </select>
        </label>

        <label className={labelClass}>
          Entra
          <select
            value={manual ? "__manual" : playerIn?.id ?? ""}
            disabled={disabled}
            onChange={(event) => setPlayerInId(event.target.value)}
            className={fieldClass}
          >
            {available.map((player) => (
              <option key={player.id} value={player.id}>
                {rosterLabel(player)}
              </option>
            ))}
            <option value="__manual">Otro nombre…</option>
          </select>
        </label>

        <label className={labelClass}>
          Posición
          <select
            value={position}
            disabled={disabled}
            onChange={(event) => setPositionOverride(event.target.value as FieldingPosition)}
            className={fieldClass}
          >
            {positions.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        {manual ? (
          <label className={`${labelClass} sm:col-span-2`}>
            Nombre
            <input
              type="text"
              value={manualName}
              disabled={disabled}
              onChange={(event) => setManualName(event.target.value)}
              className={fieldClass}
              placeholder="Nombre del jugador"
            />
          </label>
        ) : null}

        <label className={`${labelClass} sm:col-span-2`}>
          Motivo
          <select
            value={reason}
            disabled={disabled}
            onChange={(event) => setReason(event.target.value as SubstitutionReason)}
            className={fieldClass}
          >
            {reasons.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-space-sm flex flex-wrap gap-space-sm">
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !playerOut || (!manual && !playerIn) || (manual && manualName.trim() === "")}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-none border border-accent bg-accent px-space-md font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-50"
        >
          Cambiar
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink-muted hover:border-accent hover:text-accent"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
