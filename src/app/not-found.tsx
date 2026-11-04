import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="font-label-caps text-label-caps uppercase text-accent">404</p>
      <h1 className="mt-3 font-display text-headline-md uppercase text-ink sm:text-headline-lg">
        No encontrado
      </h1>
      <p className="mt-3 font-body text-body-md text-ink-muted">
        La página que buscas no existe o se movió dentro del registro abierto.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center border-b-2 border-transparent bg-band px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
        >
          Volver a la portada
        </Link>
        <Link
          href="/demo"
          className="inline-flex items-center border border-line-strong px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-surface-low"
        >
          Demostración
        </Link>
      </div>
    </div>
  );
}
