import type { PitchPayload } from "@olb/contract/types";

type SimpleCall = Extract<PitchPayload["call"], "B" | "S" | "F" | "T" | "H" | "I">;

interface PitchPadProps {
  onPitch: (call: SimpleCall) => void;
  onInPlay: () => void;
  disabled?: boolean;
}

const buttonClass =
  "min-h-20 rounded-none border border-line-strong bg-raised px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent active:bg-surface-low disabled:opacity-60";

/** The five large tap targets a scorekeeper uses for every pitch. */
export function PitchPad({ onPitch, onInPlay, disabled = false }: PitchPadProps) {
  return (
    <div className="grid grid-cols-2 gap-space-sm">
      <button
        type="button"
        className={buttonClass}
        onClick={() => onPitch("B")}
        disabled={disabled}
      >
        Bola
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onPitch("S")}
        disabled={disabled}
      >
        Strike
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onPitch("F")}
        disabled={disabled}
      >
        Foul
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onPitch("T")}
        disabled={disabled}
      >
        Foul tip
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onPitch("H")}
        disabled={disabled}
      >
        HBP
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onPitch("I")}
        disabled={disabled}
      >
        Intencional
      </button>
      <button
        type="button"
        className={`${buttonClass} col-span-2 border-accent bg-accent text-band-ink hover:bg-band hover:text-band-ink`}
        onClick={onInPlay}
        disabled={disabled}
      >
        En juego
      </button>
    </div>
  );
}
