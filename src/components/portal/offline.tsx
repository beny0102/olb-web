import Link from "next/link";
import { Arrow } from "./primitives";

export function PortalOffline() {
  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-10 md:px-8">
      <div className="border-l-4 border-accent bg-band p-6 text-band-ink">
        <span className="inline-flex items-center gap-2 bg-accent px-2 py-1 font-label-caps text-label-caps uppercase">
          <span className="size-1.5 bg-band-ink" />
          Registro no disponible
        </span>
        <h1 className="mt-4 font-display text-headline-lg-mobile uppercase sm:text-headline-lg">
          La API no respondió
        </h1>
        <p className="mt-3 max-w-2xl font-body text-body-md text-band-muted">
          Esta portada lee juegos, estados y eventos de <span className="font-mono text-band-ink">olb-api</span>.
          Sin esa fuente no hay marcador, jornada ni acta que mostrar, y no se inventan datos.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 border-b-2 border-transparent bg-accent px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-band-ink"
          >
            Abrir la demostración estática <Arrow />
          </Link>
          <a
            href="https://github.com/beny0102/olb-api"
            rel="noreferrer"
            target="_blank"
            className="border border-band-ink px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:bg-band-ink hover:text-band"
          >
            Ver olb-api ↗
          </a>
        </div>
      </div>
    </main>
  );
}
