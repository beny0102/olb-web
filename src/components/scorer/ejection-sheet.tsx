"use client";

import { useState } from "react";
import type { EjectionPayload } from "@olb/contract/types";
import type { Lineup, TeamSide } from "@/lib/scorer/types";

export type EjectionRole = EjectionPayload["role"];

export interface EjectionSelection {
  personId: string | null;
  personName: string;
  role: EjectionRole;
  reason: string;
}

interface EjectionSheetProps {
  teams: { home: string; away: string };
  lineups: { home: Lineup | null; away: Lineup | null };
  onEject: (selection: EjectionSelection) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const roles: Array<{ value: EjectionRole; label: string }> = [
  { value: "player", label: "Jugador" },
  { value: "coach", label: "Entrenador" },
  { value: "manager", label: "Mánager" },
  { value: "umpire", label: "Árbitro" },
  { value: "other", label: "Otra persona" },
];

const fieldClass =
  "mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink focus:border-accent disabled:bg-surface-low";
const labelClass = "block font-label-caps text-label-caps uppercase text-ink-muted";

/** A short audit form for removing a person from the game. */
export function EjectionSheet({
  teams,
  lineups,
  onEject,
  onCancel,
  disabled = false,
}: EjectionSheetProps) {
  const [personId, setPersonId] = useState("");
  const [manualName, setManualName] = useState("");
  const [role, setRole] = useState<EjectionRole>("player");
  const [reason, setReason] = useState("");

  const people: Array<{ id: string; label: string }> = [];
  for (const side of ["away", "home"] as TeamSide[]) {
    const lineup = lineups[side];
    if (!lineup) continue;
    for (const player of lineup.players) {
      people.push({
        id: player.id,
        label: `${side === "away" ? teams.away : teams.home} · ${player.name}`,
      });
    }
  }

  const manual = personId === "__manual";
  const selectedName = people.find((person) => person.id === personId)?.label ?? manualName.trim();
  const valid = reason.trim() !== "" && selectedName !== "";

  function submit(): void {
    if (!valid) return;
    onEject({
      personId: manual ? null : personId,
      personName: selectedName,
      role,
      reason: reason.trim(),
    });
  }

  return (
    <section className="border border-line-strong bg-surface-low p-space-sm">
      <p className="mb-space-sm font-label-caps text-label-caps uppercase text-ink-muted">
        Expulsión
      </p>

      <div className="grid gap-space-sm sm:grid-cols-2">
        <label className={labelClass}>
          Persona
          <select
            value={personId}
            disabled={disabled}
            onChange={(event) => setPersonId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Selecciona…</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
            <option value="__manual">Otra persona…</option>
          </select>
        </label>

        <label className={labelClass}>
          Rol
          <select
            value={role}
            disabled={disabled}
            onChange={(event) => setRole(event.target.value as EjectionRole)}
            className={fieldClass}
          >
            {roles.map((entry) => (
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
              placeholder="Nombre de la persona"
            />
          </label>
        ) : null}

        <label className={`${labelClass} sm:col-span-2`}>
          Motivo
          <input
            type="text"
            value={reason}
            disabled={disabled}
            onChange={(event) => setReason(event.target.value)}
            className={fieldClass}
            placeholder="Motivo de la expulsión"
          />
        </label>
      </div>

      <div className="mt-space-sm flex flex-wrap gap-space-sm">
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !valid}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-none border border-accent bg-accent px-space-md font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-50"
        >
          Expulsar
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
