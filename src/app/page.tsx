import Link from "next/link";
import { GameCard } from "@/components/game-card";
import { fetchGames, fetchState } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const games = await fetchGames().catch(() => null);
  const cards = games
    ? await Promise.all(
        games.slice(0, 6).map(async (game) => ({
          game,
          state: await fetchState(game.id).catch(() => null),
        })),
      )
    : [];

  return (
    <div className="flex flex-col gap-14">
      <section className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-grass">
          Beisbol amateur · datos abiertos
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          El juego, contado
          <br />
          <span className="text-muted">en datos abiertos.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
          Anotación, estado en vivo y una vista 3D del pitcheo para ligas que no tienen
          presupuesto de Hawk-Eye. Sin cámaras también funciona: el registro de eventos es
          el producto.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-grass px-4 py-2.5 text-sm font-semibold text-night transition-colors hover:bg-[#3a9465]"
          >
            Ver demostración
          </Link>
          <a
            href="https://github.com/beny0102/olb"
            rel="noreferrer"
            target="_blank"
            className="rounded-md border border-line px-4 py-2.5 text-sm text-chalk transition-colors hover:border-grass/60"
          >
            Leer el whitepaper
          </a>
        </div>

        <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-grass" /> Funciona sin cámaras
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-grass" /> Contrato versionado
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-grass" /> Apache-2.0
          </li>
        </ul>
      </section>

      <section aria-labelledby="games-heading">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
          <h2 id="games-heading" className="text-lg font-semibold tracking-tight">
            Juegos
          </h2>
          <span className="font-mono text-[11px] text-muted">
            {games ? `${games.length} en la API` : "API no disponible"}
          </span>
        </div>

        {games === null ? (
          <div className="panel mt-5 p-6">
            <p className="text-sm font-medium text-ember">No se pudo contactar la API.</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Levanta <span className="font-mono text-chalk">olb-api</span> en{" "}
              <span className="font-mono text-chalk">localhost:3000</span> y recarga. Mientras
              tanto, la demostración estática no necesita backend.
            </p>
            <Link
              href="/demo"
              className="mt-4 inline-block rounded-md border border-line px-3 py-2 text-sm transition-colors hover:border-grass/60"
            >
              Abrir demostración →
            </Link>
          </div>
        ) : cards.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No hay juegos todavía. Crea uno con{" "}
            <span className="font-mono text-chalk">POST /games</span>.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ game, state }) => (
              <GameCard key={game.id} game={game} state={state} />
            ))}
          </div>
        )}
      </section>

      <section className="border-t border-line pt-8" aria-labelledby="stack-heading">
        <h2 id="stack-heading" className="text-sm font-semibold">
          Cómo está armado
        </h2>
        <div className="mt-4 grid gap-4 text-sm text-muted sm:grid-cols-3">
          <p>
            <span className="block font-mono text-xs text-chalk">olb-contract</span>
            Esquemas JSON con codegen a TypeScript y Python. Un solo contrato para todos los
            servicios.
          </p>
          <p>
            <span className="block font-mono text-xs text-chalk">olb-api</span>
            Registro de eventos append-only. El estado se pliega desde el log, nunca se edita a
            mano.
          </p>
          <p>
            <span className="block font-mono text-xs text-chalk">olb-web</span>
            Next.js y React Three Fiber. Esta página consume el contrato y dibuja la zona de
            strike.
          </p>
        </div>
      </section>
    </div>
  );
}
