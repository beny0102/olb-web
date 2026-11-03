"use client";

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="border-l-4 border-accent bg-raised p-6">
        <p className="font-label-caps text-label-caps uppercase text-accent">
          Error de la portada
        </p>
        <h1 className="mt-2 font-display text-headline-md uppercase text-ink">
          El acta no se pudo componer
        </h1>
        <p className="mt-2 font-body text-body-sm text-ink-muted">
          El fallo ocurrió en el cliente. Reintenta o vuelve a la portada.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 border-b-2 border-transparent bg-band px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
