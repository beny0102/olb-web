"use client";

import { useState } from "react";
import type { RulesProfile } from "@/lib/scorer/rules";

interface RulesCardProps {
  rules: RulesProfile;
  onChange: (rules: RulesProfile) => void;
  errors?: string[];
  disabled?: boolean;
}

const FIELD_CLASS =
  "mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink focus:border-accent disabled:bg-surface-low";

const LABEL_CLASS =
  "block font-label-caps text-label-caps uppercase text-ink-muted";

const CHECK_CLASS = "flex min-h-12 items-center gap-space-sm";

function summaryFor(rules: RulesProfile): string {
  const innings = rules.innings === 1 ? "1 entrada" : `${rules.innings} entradas`;
  const mercy = rules.mercy.enabled
    ? `misericordia ${rules.mercy.runs} desde la ${rules.mercy.afterInning}.ª`
    : "sin misericordia";
  return `${innings} · ${mercy} · ${rules.dh ? "DH" : "sin DH"}`;
}

function numberOrNull(value: string): number | null {
  return value === "" ? null : Number(value);
}

/** The league rule profile for one game. Collapsed until the scorer opens it. */
export function RulesCard({
  rules,
  onChange,
  errors = [],
  disabled = false,
}: RulesCardProps) {
  const [open, setOpen] = useState(false);

  function patch(next: Partial<RulesProfile>): void {
    onChange({ ...rules, ...next });
  }

  return (
    <section className="border border-line-strong bg-raised">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-space-md px-space-md py-space-sm text-left hover:text-accent"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <span className="block font-display text-headline-sm text-ink">
            Reglas del juego
          </span>
          <span className="mt-space-xs block font-body text-body-sm text-ink-muted">
            {summaryFor(rules)}
          </span>
        </span>
        <span className="font-label-caps text-label-caps uppercase text-ink-muted">
          {open ? "Cerrar" : "Editar"}
        </span>
      </button>

      {open ? (
        <fieldset disabled={disabled} className="border-t border-line px-space-md py-space-md">
          <div className="grid gap-space-md sm:grid-cols-2">
            <label className={LABEL_CLASS}>
              Entradas
              <input
                type="number"
                min={1}
                max={12}
                inputMode="numeric"
                value={rules.innings}
                disabled={disabled}
                onChange={(event) => patch({ innings: Number(event.target.value) })}
                className={FIELD_CLASS}
              />
            </label>

            <label className={LABEL_CLASS}>
              Límite de entradas (opcional)
              <input
                type="number"
                min={1}
                max={12}
                inputMode="numeric"
                placeholder="Sin límite"
                value={rules.inningLimit ?? ""}
                disabled={disabled}
                onChange={(event) => patch({ inningLimit: numberOrNull(event.target.value) })}
                className={FIELD_CLASS}
              />
            </label>

            <label className={LABEL_CLASS}>
              Límite de lanzamientos (opcional)
              <input
                type="number"
                min={1}
                max={300}
                inputMode="numeric"
                placeholder="Sin límite"
                value={rules.pitchLimit ?? ""}
                disabled={disabled}
                onChange={(event) => patch({ pitchLimit: numberOrNull(event.target.value) })}
                className={FIELD_CLASS}
              />
            </label>

            <div className="space-y-space-sm border-t border-line pt-space-sm sm:border-0 sm:pt-0">
              <label className={CHECK_CLASS}>
                <input
                  type="checkbox"
                  checked={rules.dh}
                  disabled={disabled}
                  onChange={(event) => patch({ dh: event.target.checked })}
                />
                <span className="font-body text-body-md text-ink">
                  Bateador designado (DH)
                </span>
              </label>
              <label className={CHECK_CLASS}>
                <input
                  type="checkbox"
                  checked={rules.courtesyRunner}
                  disabled={disabled}
                  onChange={(event) => patch({ courtesyRunner: event.target.checked })}
                />
                <span className="font-body text-body-md text-ink">Corredor cortés</span>
              </label>
            </div>
          </div>

          <div className="mt-space-md border-t border-line pt-space-md">
            <label className={CHECK_CLASS}>
              <input
                type="checkbox"
                checked={rules.mercy.enabled}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...rules,
                    mercy: { ...rules.mercy, enabled: event.target.checked },
                  })
                }
              />
              <span className="font-body text-body-md text-ink">Misericordia</span>
            </label>
            {rules.mercy.enabled ? (
              <div className="mt-space-sm grid gap-space-md sm:grid-cols-2">
                <label className={LABEL_CLASS}>
                  Diferencia de carreras
                  <input
                    type="number"
                    min={1}
                    max={30}
                    inputMode="numeric"
                    value={rules.mercy.runs}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({
                        ...rules,
                        mercy: { ...rules.mercy, runs: Number(event.target.value) },
                      })
                    }
                    className={FIELD_CLASS}
                  />
                </label>
                <label className={LABEL_CLASS}>
                  Desde la entrada
                  <input
                    type="number"
                    min={1}
                    max={12}
                    inputMode="numeric"
                    value={rules.mercy.afterInning}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({
                        ...rules,
                        mercy: { ...rules.mercy, afterInning: Number(event.target.value) },
                      })
                    }
                    className={FIELD_CLASS}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="mt-space-md border-t border-line pt-space-md">
            <label className={CHECK_CLASS}>
              <input
                type="checkbox"
                checked={rules.extraInnings.enabled}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...rules,
                    extraInnings: { ...rules.extraInnings, enabled: event.target.checked },
                  })
                }
              />
              <span className="font-body text-body-md text-ink">Extra innings</span>
            </label>
            {rules.extraInnings.enabled ? (
              <label className={`${CHECK_CLASS} ml-space-md`}>
                <input
                  type="checkbox"
                  checked={rules.extraInnings.placedRunner}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...rules,
                      extraInnings: {
                        ...rules.extraInnings,
                        placedRunner: event.target.checked,
                      },
                    })
                  }
                />
                <span className="font-body text-body-md text-ink">
                  Corredor automático en 2.ª
                </span>
              </label>
            ) : null}
          </div>

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
      ) : null}
    </section>
  );
}
