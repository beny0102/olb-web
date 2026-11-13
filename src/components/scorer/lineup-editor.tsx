"use client";

import { fieldingPosition } from "@/lib/scorer/roster";
import type { FieldingPosition, Lineup, Player, RosterPlayer } from "@/lib/scorer/types";

const POSITIONS: FieldingPosition[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "DH"];

interface LineupEditorProps {
  title: string;
  lineup: Lineup;
  onChange: (lineup: Lineup) => void;
  errors?: string[];
  disabled?: boolean;
  /** A league roster turns on the “Cargar plantilla” shortcut. */
  roster?: RosterPlayer[];
  onLoadRoster?: () => void;
  rosterError?: string | null;
}

function playerLabel(player: Player): string {
  return player.name.trim() || `Jugador ${player.battingSlot}`;
}

/** Nine batting slots with a fielding position and one pitcher. */
export function LineupEditor({
  title,
  lineup,
  onChange,
  errors = [],
  disabled = false,
  roster,
  onLoadRoster,
  rosterError = null,
}: LineupEditorProps) {
  function updatePlayer(id: string, patch: Partial<Player>): void {
    onChange({
      ...lineup,
      players: lineup.players.map((player) =>
        player.id === id ? { ...player, ...patch } : player,
      ),
    });
  }

  // With the DH rule the pitcher is not one of the nine batters, so the
  // roster's pitchers must stay selectable without entering the batting order.
  const benchPitchers = (roster ?? []).filter(
    (player) =>
      fieldingPosition(player.position) === "1" &&
      !lineup.players.some((entry) => entry.id === player.id),
  );

  return (
    <section className="border border-line-strong bg-raised">
      <header className="flex flex-wrap items-center justify-between gap-space-sm border-b border-line px-space-md py-space-sm">
        <h2 className="font-display text-headline-sm text-ink">{title}</h2>
        {roster && onLoadRoster ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onLoadRoster}
            className="inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-60"
          >
            Cargar plantilla
          </button>
        ) : null}
      </header>

      <fieldset disabled={disabled} className="px-space-md py-space-md">
        <div
          className="mb-space-sm grid grid-cols-[1.75rem_minmax(0,1fr)_4.75rem] items-center gap-space-sm"
          aria-hidden="true"
        >
          <span />
          <span className="font-label-caps text-label-caps uppercase text-ink-muted">
            Bateador
          </span>
          <span className="font-label-caps text-label-caps uppercase text-ink-muted">
            Pos.
          </span>
        </div>
        <div className="space-y-space-sm">
          {lineup.players.map((player) => (
            <div
              key={player.id}
              className="grid grid-cols-[1.75rem_minmax(0,1fr)_4.75rem] items-center gap-space-sm"
            >
              <span className="score-num font-tabular-stats text-tabular-stats text-ink-muted">
                {player.battingSlot}
              </span>
              <input
                type="text"
                value={player.name}
                maxLength={60}
                required
                disabled={disabled}
                placeholder="Nombre"
                aria-label={`${title}: nombre del bateador ${player.battingSlot}`}
                onChange={(event) => updatePlayer(player.id, { name: event.target.value })}
                className="min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink placeholder:text-ink-muted focus:border-accent disabled:bg-surface-low"
              />
              <select
                value={player.position}
                disabled={disabled}
                aria-label={`${title}: posición del bateador ${player.battingSlot}`}
                onChange={(event) =>
                  updatePlayer(player.id, {
                    position: event.target.value as FieldingPosition,
                  })
                }
                className="score-num min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-xs font-tabular-stats text-tabular-stats text-ink focus:border-accent disabled:bg-surface-low"
              >
                {POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <label className="mt-space-md block border-t border-line pt-space-md">
          <span className="font-label-caps text-label-caps uppercase text-ink-muted">
            Pitcher
          </span>
          <select
            value={lineup.pitcherId}
            disabled={disabled}
            aria-label={`${title}: pitcher`}
            onChange={(event) => onChange({ ...lineup, pitcherId: event.target.value })}
            className="mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink focus:border-accent disabled:bg-surface-low"
          >
            <option value="">Elegir pitcher</option>
            {lineup.players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.battingSlot}. {playerLabel(player)}
              </option>
            ))}
            {benchPitchers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name.trim() || "Pitcher"} · {player.position}
              </option>
            ))}
          </select>
        </label>

        {rosterError ? (
          <p
            role="alert"
            className="mt-space-md border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-sm text-ink"
          >
            {rosterError}
          </p>
        ) : null}

        {errors.length > 0 ? (
          <ul
            role="alert"
            className="mt-space-md space-y-space-xs border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm"
          >
            {errors.map((error) => (
              <li key={error} className="font-body text-body-sm text-ink">
                {error}
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>
    </section>
  );
}
