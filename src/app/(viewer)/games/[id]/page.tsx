import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveGame } from "@/components/live-game";
import { fetchGamePage } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchGamePage(id);

  if (data.kind === "missing") notFound();

  if (data.kind === "offline") {
    return (
      <div className="panel mx-auto max-w-xl p-6">
        <p className="text-sm font-medium text-ember">La API no respondió.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          El visor necesita <span className="font-mono text-chalk">olb-api</span> para leer el
          registro del juego. También puedes ver la demostración estática.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/demo"
            className="rounded-md border border-nightline px-3 py-2 text-sm transition-colors hover:border-grass/60"
          >
            Ir a la demostración
          </Link>
          <Link href="/" className="px-3 py-2 text-sm text-muted hover:text-chalk">
            Volver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex items-center gap-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-chalk">
          Juegos
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-chalk">{data.game.id.slice(0, 13)}…</span>
      </nav>

      <LiveGame
        game={data.game}
        initialState={data.state}
        initialEvents={data.events}
        initialBoxScore={data.boxScore}
      />
    </div>
  );
}
