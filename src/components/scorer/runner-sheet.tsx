"use client";

import { useState } from "react";

export type RunnerActionKind =
  | "steal"
  | "caught_stealing"
  | "pickoff"
  | "wild_pitch"
  | "passed_ball"
  | "balk";

export interface RunnerAction {
  player: string;
  from: "1" | "2" | "3";
  action: RunnerActionKind;
}

interface RunnerSheetProps {
  bases: { first: string | null; second: string | null; third: string | null };
  playerName: (id: string) => string;
  onAction: (action: RunnerAction) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const actions: Array<{ kind: RunnerActionKind; label: string }> = [
  { kind: "steal", label: "Robo" },
  { kind: "caught_stealing", label: "CS" },
  { kind: "pickoff", label: "Pickoff" },
  { kind: "wild_pitch", label: "WP" },
  { kind: "passed_ball", label: "PB" },
  { kind: "balk", label: "Balk" },
];

function baseLabel(from: "1" | "2" | "3"): string {
  return from === "1" ? "1.ª base" : from === "2" ? "2.ª base" : "3.ª base";
}

const buttonClass =
  "min-h-12 rounded-none border border-line-strong bg-raised px-space-sm font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent active:bg-surface-low disabled:opacity-60";

/** Baserunning actions for one occupied base. */
export function RunnerSheet({
  bases,
  playerName,
  onAction,
  onCancel,
  disabled = false,
}: RunnerSheetProps) {
  const occupied: Array<{ from: "1" | "2" | "3"; player: string }> = [];
  if (bases.first) occupied.push({ from: "1", player: bases.first });
  if (bases.second) occupied.push({ from: "2", player: bases.second });
  if (bases.third) occupied.push({ from: "3", player: bases.third });

  const [from, setFrom] = useState<"1" | "2" | "3" | "">(occupied[0]?.from ?? "");
  const selected = occupied.find((entry) => entry.from === from) ?? occupied[0];

  return (
    <section className="border border-line-strong bg-surface-low p-space-sm">
      <p className="mb-space-sm font-label-caps text-label-caps uppercase text-ink-muted">
        Corredores
      </p>

      {occupied.length === 0 ? (
        <p className="font-body text-body-md text-ink-muted">
          No hay corredores en base.
        </p>
      ) : (
        <div className="space-y-space-sm">
          <label className="block font-label-caps text-label-caps uppercase text-ink-muted">
            Base
            <select
              value={from}
              disabled={disabled}
              onChange={(event) => setFrom(event.target.value as "1" | "2" | "3")}
              className="mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink focus:border-accent"
            >
              {occupied.map((entry) => (
                <option key={entry.from} value={entry.from}>
                  {baseLabel(entry.from)} · {playerName(entry.player)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-space-sm">
            {actions.map((action) => (
              <button
                key={action.kind}
                type="button"
                className={buttonClass}
                disabled={disabled || !selected}
                onClick={() => {
                  if (!selected) return;
                  onAction({ player: selected.player, from: selected.from, action: action.kind });
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
