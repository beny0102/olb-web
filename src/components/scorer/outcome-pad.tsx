import type { OutcomeCode } from "@/lib/scorer/scoring";

interface OutcomePadProps {
  onSelect: (code: OutcomeCode) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const buttonClass =
  "min-h-16 rounded-none border border-line-strong bg-raised px-space-sm font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent active:bg-surface-low disabled:opacity-60";

const options: Array<{ code: OutcomeCode; label: string }> = [
  { code: "out", label: "Out" },
  { code: "1B", label: "1B" },
  { code: "2B", label: "2B" },
  { code: "3B", label: "3B" },
  { code: "HR", label: "HR" },
  { code: "E", label: "Error" },
  { code: "FC", label: "FC" },
  { code: "DP", label: "Doble play" },
  { code: "SAC", label: "Sacrificio" },
];

/** The outcome of a ball in play. The X pitch is not logged until one is chosen. */
export function OutcomePad({ onSelect, onCancel, disabled = false }: OutcomePadProps) {
  return (
    <section className="border border-line-strong bg-surface-low p-space-sm">
      <p className="mb-space-sm font-label-caps text-label-caps uppercase text-ink-muted">
        Resultado de la jugada
      </p>
      <div className="grid grid-cols-2 gap-space-sm">
        {options.map((option) => (
          <button
            key={option.code}
            type="button"
            className={buttonClass}
            onClick={() => onSelect(option.code)}
            disabled={disabled}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={`${buttonClass} col-span-2 border-line text-ink-muted`}
          onClick={onCancel}
          disabled={disabled}
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
