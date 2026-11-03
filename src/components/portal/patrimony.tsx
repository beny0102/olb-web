import Link from "next/link";
import { CONTRACT_VERSION } from "@/lib/league";
import { Arrow } from "./primitives";

const DOCS = [
  {
    label: "Whitepaper y arquitectura",
    href: "https://github.com/beny0102/olb",
    note: "Diseño del registro, autoridad de datos y hoja de ruta.",
  },
  {
    label: "Contrato y esquemas",
    href: "https://github.com/beny0102/olb-contract",
    note: "JSON Schema, codegen TypeScript/Python y fixtures.",
  },
  {
    label: "API y registro",
    href: "https://github.com/beny0102/olb-api",
    note: "Log append-only, proyección GameState y health.",
  },
];

function Shield({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        fill="currentColor"
        d="M12 2 4 5v6c0 5.2 3.4 9.1 8 11 4.6-1.9 8-5.8 8-11V5l-8-3Zm0 3.1 5 1.9V11c0 3.6-2.1 6.6-5 8.1-2.9-1.5-5-4.5-5-8.1V6.9l5-1.8Z"
      />
    </svg>
  );
}

export function PortalPatrimony() {
  return (
    <section className="relative overflow-hidden border-t-4 border-gold bg-band py-10 text-band-ink">
      <Shield className="pointer-events-none absolute bottom-2 right-2 size-56 text-band-ink/5" />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="block font-label-caps text-label-caps uppercase text-gold">
              Archivo patrimonial del proyecto
            </span>
            <h2 className="mt-1 font-display text-headline-lg-mobile uppercase sm:text-headline-lg">
              Acta fundacional
            </h2>
          </div>
          <span className="font-label-caps text-label-caps uppercase text-gold">
            Contrato abierto · registro permanente
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col justify-between border border-band-ink/25 bg-band-ink/5 p-5 lg:col-span-8">
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-band-ink/20 pb-2">
                <span className="bg-gold px-2 py-0.5 font-label-caps text-label-caps uppercase text-band">
                  Acta de fundación
                </span>
                <span className="font-label-caps text-label-caps uppercase text-band-muted">
                  Open League Baseball · código abierto
                </span>
              </div>

              <div className="mb-4 flex items-start gap-4">
                <div className="grid size-16 shrink-0 place-items-center border-2 border-gold bg-band text-gold">
                  <Shield className="size-9" />
                </div>
                <div>
                  <span className="block font-label-caps text-label-caps uppercase text-gold">
                    Proyecto fundacional
                  </span>
                  <h3 className="mt-0.5 font-display text-headline-sm uppercase">
                    El juego, contado en datos abiertos
                  </h3>
                  <p className="mt-1 font-label-caps text-label-caps uppercase text-band-muted">
                    Anotación · estado en vivo · pitcheo en 3D
                  </p>
                </div>
              </div>

              <p className="max-w-2xl font-body text-body-md text-band-muted">
                Anotación, estado en vivo y una vista 3D del pitcheo para ligas que no tienen
                presupuesto de Hawk-Eye. Sin cámaras también funciona: el registro de eventos es
                el producto. El marcador se pliega desde un log append-only y el contrato es
                público, versionado y verificable.
              </p>
            </div>

            <div className="mt-5 border-t border-band-ink/20 pt-4">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <span className="block font-display text-title-lg text-gold">
                    olb.event/1
                  </span>
                  <span className="font-label-caps text-label-caps uppercase text-band-muted">
                    Contrato versionado {CONTRACT_VERSION}
                  </span>
                </div>
                <div>
                  <span className="block font-display text-title-lg text-gold">append-only</span>
                  <span className="font-label-caps text-label-caps uppercase text-band-muted">
                    Registro inmutable
                  </span>
                </div>
                <div>
                  <span className="block font-display text-title-lg text-gold">Apache-2.0</span>
                  <span className="font-label-caps text-label-caps uppercase text-band-muted">
                    Licencia de código
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href="https://github.com/beny0102/olb"
                  rel="noreferrer"
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gold px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band transition-colors hover:bg-band-ink"
                >
                  Leer el whitepaper ↗
                </a>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 border border-band-ink px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:bg-band-ink hover:text-band"
                >
                  Ver demostración <Arrow />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between border border-band-ink/25 bg-band-ink/5 p-5 lg:col-span-4">
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-band-ink/20 pb-2">
                <span className="font-label-caps text-label-caps uppercase text-gold">
                  Archivo de gobierno
                </span>
                <span className="font-label-caps text-label-caps uppercase text-band-muted">
                  Repositorios
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {DOCS.map((doc) => (
                  <li key={doc.href}>
                    <a
                      href={doc.href}
                      rel="noreferrer"
                      target="_blank"
                      className="block border-b border-band-ink/15 py-2 transition-colors hover:text-gold"
                    >
                      <span className="flex items-center justify-between gap-2 font-label-caps text-label-caps uppercase">
                        {doc.label} <span aria-hidden="true">↗</span>
                      </span>
                      <span className="mt-0.5 block font-body text-body-sm text-band-muted">
                        {doc.note}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-band-ink/20 pt-3 font-label-caps text-label-caps uppercase text-gold">
              <span>Repositorio abierto</span>
              <a
                href="https://github.com/beny0102"
                rel="noreferrer"
                target="_blank"
                className="text-band-ink underline hover:text-gold"
              >
                Abrir GitHub ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
