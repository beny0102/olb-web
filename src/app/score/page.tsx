import Link from "next/link";
import { ScoreLocalStoreStatus } from "@/components/score/local-store-status";
import { ScoreSwStatus } from "@/components/score/sw-status";

export default function ScoreIndexPage() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
      <p className="font-label-caps text-label-caps uppercase text-accent">F8.1 · merge spike</p>
      <h1 className="mt-2 font-display text-headline-lg-mobile uppercase text-ink sm:text-headline-lg">
        Anotador
      </h1>
      <p className="mt-3 max-w-2xl font-body text-body-md text-ink-muted">
        Este es el shell mínimo del anotador dentro del portal. Sirve para probar la ruta, el
        service worker con ámbito <span className="font-mono text-ink">/score</span> y el arranque
        sin conexión. El anotador completo se integra en F8.2.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="border border-line-strong bg-surface-raised p-5">
          <h2 className="font-display text-headline-sm uppercase text-ink">Juegos locales</h2>
          <div className="mt-3">
            <ScoreLocalStoreStatus />
          </div>
        </article>

        <article className="border border-line-strong bg-surface-raised p-5">
          <h2 className="font-display text-headline-sm uppercase text-ink">PWA</h2>
          <div className="mt-3 space-y-3">
            <ScoreSwStatus />
            <p className="font-body text-body-sm text-ink-muted">
              El service worker solo se registra en <span className="font-mono text-ink">/score</span>.
              El portal no instala workers ni comparte caché con él.
            </p>
          </div>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/score/demo-game"
          className="border-b-2 border-transparent bg-band px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
        >
          Abrir shell de partido
        </Link>
        <Link
          href="/"
          className="border border-line-strong px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-surface-low"
        >
          Volver al portal
        </Link>
      </div>
    </section>
  );
}
