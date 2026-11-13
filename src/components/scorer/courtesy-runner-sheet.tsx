"use client";

import { useState } from "react";
import type { CourtesyRunnerBase } from "@/lib/scorer/rules";
import type { Player } from "@/lib/scorer/types";

interface CourtesyRunnerSheetProps {
  options: CourtesyRunnerBase[];
  onSelect: (from: "1" | "2" | "3", replacementId: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

function playerLabel(player: Player): string {
  return player.name.trim() || `Jugador ${player.battingSlot}`;
}

function baseLabel(from: "1" | "2" | "3"): string {
  return from === "1" ? "1.ª base" : from === "2" ? "2.ª base" : "3.ª base";
}

/** Pick a courtesy runner for one occupied base. */
export function CourtesyRunnerSheet({
  options,
  onSelect,
  onCancel,
  disabled = false,
}: CourtesyRunnerSheetProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});

  return (
    <section className="border border-line-strong bg-surface-low p-space-sm">
      <p className="mb-space-sm font-label-caps text-label-caps uppercase text-ink-muted">
        Corredor cortés
      </p>
      <div className="space-y-space-sm">
        {options.map((option) => {
          const replacement = selected[option.from] ?? option.replacements[0]?.id ?? "";
          return (
            <div key={option.from} className="grid gap-space-sm sm:grid-cols-[7rem_1fr_auto]">
              <span className="flex min-h-12 items-center font-body text-body-md text-ink">
                {baseLabel(option.from)}
              </span>
              <select
                value={replacement}
                disabled={disabled || option.replacements.length === 0}
                aria-label={`Reemplazo para ${baseLabel(option.from)}`}
                onChange={(event) =>
                  setSelected((current) => ({ ...current, [option.from]: event.target.value }))
                }
                className="min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink focus:border-accent disabled:bg-surface-low"
              >
                {option.replacements.length === 0 ? (
                  <option value="">Sin reemplazos disponibles</option>
                ) : (
                  option.replacements.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.battingSlot}. {playerLabel(player)}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                disabled={disabled || replacement === ""}
                onClick={() => onSelect(option.from, replacement)}
                className="inline-flex min-h-12 items-center justify-center rounded-none border border-accent bg-accent px-space-md font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-50"
              >
                Colocar
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="mt-space-sm inline-flex min-h-12 w-full items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink-muted hover:border-accent hover:text-accent"
      >
        Cancelar
      </button>
    </section>
  );
}
