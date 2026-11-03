import Link from "next/link";
import { CONTRACT_VERSION } from "@/lib/league";

const LINK_CLASS = "transition-colors hover:text-ink";

export function PortalFooter() {
  return (
    <footer className="border-t border-line bg-surface-low">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-10 md:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="font-display text-headline-sm uppercase text-ink">
              Liga Metropolitana
            </div>
            <p className="mt-2 max-w-xs font-body text-body-sm text-ink-muted">
              Portada oficial de Open League Baseball. Autoridad de datos: el registro
              append-only de <span className="font-mono">olb-api</span>.
            </p>
            <div className="mt-4 font-label-caps text-label-caps uppercase text-accent">
              Contrato olb.event/1 · {CONTRACT_VERSION}
            </div>
          </div>

          <div>
            <div className="mb-3 font-label-caps text-label-caps uppercase text-ink">
              Navegación
            </div>
            <ul className="space-y-1.5 font-body text-body-sm text-ink-muted">
              <li>
                <Link href="/" className={LINK_CLASS}>
                  Portada
                </Link>
              </li>
              <li>
                <Link href="/#jornada" className={LINK_CLASS}>
                  Juegos
                </Link>
              </li>
              <li>
                <Link href="/demo" className={LINK_CLASS}>
                  Demostración estática
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/beny0102/olb"
                  rel="noreferrer"
                  target="_blank"
                  className={LINK_CLASS}
                >
                  Whitepaper ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-3 font-label-caps text-label-caps uppercase text-ink">
              Proyecto
            </div>
            <ul className="space-y-1.5 font-body text-body-sm text-ink-muted">
              <li>
                <a
                  href="https://github.com/beny0102/olb-contract"
                  rel="noreferrer"
                  target="_blank"
                  className={LINK_CLASS}
                >
                  Contrato y esquemas ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/beny0102/olb-api"
                  rel="noreferrer"
                  target="_blank"
                  className={LINK_CLASS}
                >
                  API y registro ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/beny0102/olb-web"
                  rel="noreferrer"
                  target="_blank"
                  className={LINK_CLASS}
                >
                  Este visor ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="mb-3 font-label-caps text-label-caps uppercase text-ink">
              Registro
            </div>
            <p className="font-body text-body-sm text-ink-muted">
              Sin clasificación, alineaciones ni estadísticas de jugadores: esos dominios todavía
              no existen en la API.
            </p>
            <div className="mt-3 font-label-caps text-label-caps uppercase text-accent">
              Apache-2.0 · sin afiliación con MLB
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-4 font-label-caps text-label-caps uppercase text-ink-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Open League Baseball · todos los derechos reservados</span>
          <span>Datos servidos por olb-api · sin datos inventados</span>
        </div>
      </div>
    </footer>
  );
}
