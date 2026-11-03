import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">404</p>
      <h1 className="mt-3 text-2xl font-semibold">Ese juego no existe.</h1>
      <p className="mt-3 text-sm text-muted">
        Puede que el identificador esté mal o que el juego se haya eliminado del registro.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-grass px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-[#3a9465]"
        >
          Ver juegos
        </Link>
        <Link
          href="/demo"
          className="rounded-md border border-nightline px-4 py-2 text-sm transition-colors hover:border-grass/60"
        >
          Demostración
        </Link>
      </div>
    </div>
  );
}
