import Link from "next/link";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";
import { Arrow } from "@/components/portal/primitives";

export default function PortalNotFound() {
  return (
    <>
      <PortalHeader active={null} />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-16 md:px-8">
        <div className="max-w-2xl">
          <div className="border-b border-line pb-4">
            <span className="block font-label-caps text-label-caps uppercase text-accent">
              Error 404
            </span>
            <h1 className="mt-1 font-display text-headline-md uppercase text-ink sm:text-headline-lg">
              Ese club no existe.
            </h1>
          </div>

          <p className="mt-4 max-w-xl font-body text-body-md text-ink-muted">
            El club que buscas no está en el registro de la Liga Metropolitana. Revisa la
            portada o consulta la tabla de posiciones.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 border-b-2 border-transparent bg-band px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
            >
              Volver a la portada <Arrow />
            </Link>
            <Link
              href="/#posiciones"
              className="inline-flex items-center gap-2 border border-band bg-transparent px-6 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band transition-colors hover:bg-band hover:text-band-ink"
            >
              Ver posiciones <Arrow />
            </Link>
          </div>
        </div>
      </main>
      <PortalFooter />
    </>
  );
}
