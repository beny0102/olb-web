"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ScoreLocalStoreStatus } from "@/components/score/local-store-status";
import { ScoreSwStatus } from "@/components/score/sw-status";

export default function ScoreGamePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "sin-id";

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
      <p className="font-label-caps text-label-caps uppercase text-accent">F8.1 · merge spike</p>
      <h1
        data-score-game-id={id}
        className="mt-2 break-words font-display text-headline-lg-mobile uppercase text-ink sm:text-headline-lg"
      >
        Anotador · {id}
      </h1>
      <p className="mt-3 max-w-2xl font-body text-body-md text-ink-muted">
        Shell compacto de la ruta de anotación. Confirma que el portal sirve{" "}
        <span className="font-mono text-ink">/score/[id]</span> con su propio layout y que la
        página sigue viva tras recargar sin red. Todavía no carga el anotador completo.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="border border-line-strong bg-surface-raised p-5">
          <h2 className="font-display text-headline-sm uppercase text-ink">Almacenamiento local</h2>
          <div className="mt-3">
            <ScoreLocalStoreStatus />
          </div>
        </article>

        <article className="border border-line-strong bg-surface-raised p-5">
          <h2 className="font-display text-headline-sm uppercase text-ink">Estado offline</h2>
          <div className="mt-3 space-y-3">
            <ScoreSwStatus />
            <p className="font-body text-body-sm text-ink-muted">
              Primera carga en línea, recarga para que el worker controle la página y después
              desactiva la red: el shell debe seguir renderizando.
            </p>
          </div>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/score"
          className="border border-line-strong px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-surface-low"
        >
          ← Volver al índice del anotador
        </Link>
        <Link
          href="/"
          className="bg-band px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:bg-accent"
        >
          Volver al portal
        </Link>
      </div>
    </section>
  );
}
