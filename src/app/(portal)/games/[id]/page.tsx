import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveGame } from "@/components/live-game";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";
import { fetchGamePage } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchGamePage(id);

  if (data.kind === "missing") notFound();

  if (data.kind === "offline") {
    return (
      <>
        <PortalHeader active={null} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
          <div className="mx-auto max-w-xl border border-line-strong bg-raised p-6">
            <p className="font-label-caps text-label-caps uppercase text-accent">
              API sin conexión
            </p>
            <p className="mt-2 font-body text-body-md leading-relaxed text-ink-muted">
              El visor necesita <span className="font-mono text-ink">olb-api</span> para leer el
              registro del juego. También puedes ver la demostración estática.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/demo"
                className="inline-flex items-center border-b-2 border-transparent bg-band px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
              >
                Ir a la demostración
              </Link>
              <Link
                href="/"
                className="inline-flex items-center border border-line-strong px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-ink transition-colors hover:bg-surface-low"
              >
                Volver
              </Link>
            </div>
          </div>
        </main>
        <PortalFooter />
      </>
    );
  }

  return (
    <>
      <PortalHeader active={null} />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        <div className="flex flex-col gap-6">
          <nav
            aria-label="Ruta"
            className="flex items-center gap-2 font-label-caps text-label-caps uppercase text-ink-muted"
          >
            <Link href="/" className="transition-colors hover:text-ink">
              Juegos
            </Link>
            <span aria-hidden="true">/</span>
            <span className="truncate text-ink">{data.game.id.slice(0, 13)}…</span>
          </nav>

          <LiveGame
            game={data.game}
            initialState={data.state}
            initialEvents={data.events}
            initialBoxScore={data.boxScore}
          />
        </div>
      </main>
      <PortalFooter />
    </>
  );
}
