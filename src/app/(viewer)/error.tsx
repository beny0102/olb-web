"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel mx-auto max-w-lg p-6">
      <p className="text-sm font-medium text-ember">Algo se rompió en el visor.</p>
      <p className="mt-2 text-sm text-muted">
        El error quedó del lado del cliente. Reintenta o vuelve a la lista de juegos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-md border border-nightline px-3 py-2 text-sm transition-colors hover:border-grass/60"
      >
        Reintentar
      </button>
    </div>
  );
}
