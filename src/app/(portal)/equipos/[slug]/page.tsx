import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";
import { PortalOffline } from "@/components/portal/offline";
import { Arrow, SectionHeader, StatusBadge } from "@/components/portal/primitives";
import { formatPct, formatScheduledStart } from "@/lib/format";
import {
  fetchPortalData,
  formatTime,
  gameStatus,
  orderSlate,
  shortGameId,
  teamAbbr,
  teamFromSlug,
  teamSlug,
  type PortalData,
  type PortalGame,
} from "@/lib/league";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Club",
  description:
    "Acta del club en la Liga Metropolitana de Open League Baseball: récord, próximos juegos y resultados.",
};

function clubGames(games: readonly PortalGame[], team: string): PortalGame[] {
  return orderSlate(
    games.filter(
      (entry) => entry.game.homeTeam === team || entry.game.awayTeam === team,
    ),
  );
}

function opponent(entry: PortalGame, team: string): string {
  return entry.game.homeTeam === team ? entry.game.awayTeam : entry.game.homeTeam;
}

function side(entry: PortalGame, team: string): "Local" | "Visitante" {
  return entry.game.homeTeam === team ? "Local" : "Visitante";
}

function score(entry: PortalGame): string {
  return entry.state ? `${entry.state.score.away}–${entry.state.score.home}` : "—";
}

function namesIn(data: PortalData): string[] {
  const standings = data.standings?.teams.map((row) => row.team) ?? [];
  const games = data.games.flatMap((entry) => [entry.game.homeTeam, entry.game.awayTeam]);
  return [...new Set([...standings, ...games])];
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchPortalData();

  if (!data) {
    return (
      <div data-team={slug}>
        <PortalHeader />
        <PortalOffline />
        <PortalFooter />
      </div>
    );
  }

  const team = teamFromSlug(slug, namesIn(data));
  if (!team) notFound();

  const games = clubGames(data.games, team);
  const finals = games.filter((entry) => gameStatus(entry) === "final");
  const live = games.find((entry) => gameStatus(entry) === "live") ?? null;
  const next = games.find((entry) => gameStatus(entry) === "scheduled") ?? null;
  const last = finals[0] ?? null;
  const record = data.standings?.teams.find((row) => row.team === team) ?? null;

  return (
    <div data-team={teamSlug(team)}>
      <PortalHeader />
      <main>
        <section aria-labelledby="club-title" className="bg-band text-band-ink">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-accent px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink">
                    Club · Liga Metropolitana
                  </span>
                  {live ? <StatusBadge status="live" /> : null}
                  <Link
                    href="/#posiciones"
                    className="font-label-caps text-label-caps uppercase text-band-muted transition-colors hover:text-band-ink"
                  >
                    Tabla de posiciones <Arrow />
                  </Link>
                </div>

                <h1
                  id="club-title"
                  className="mt-4 break-words font-display text-display-hero-mobile uppercase sm:text-display-hero"
                >
                  {team}
                </h1>

                {finals.length > 0 && record ? (
                  <dl className="mt-6 grid max-w-md grid-cols-3 gap-4 border-t border-band-ink/20 pt-4">
                    <div>
                      <dt className="font-label-caps text-label-caps uppercase text-band-muted">
                        G-P
                      </dt>
                      <dd className="mt-1 font-display text-tabular-stats">
                        {record.w}-{record.l}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-label-caps text-label-caps uppercase text-band-muted">
                        Pct
                      </dt>
                      <dd className="mt-1 font-display text-tabular-stats">
                        {formatPct(record.pct)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-label-caps text-label-caps uppercase text-band-muted">
                        CF/CC
                      </dt>
                      <dd className="mt-1 font-display text-tabular-stats">
                        {record.runsFor}/{record.runsAgainst}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-6 border-t border-band-ink/20 pt-4 font-body text-body-md text-band-muted">
                    {finals.length > 0
                      ? "Sin clasificación oficial para este club."
                      : "Sin resultados finales"}
                  </p>
                )}
              </div>

              <div
                aria-hidden="true"
                className="grid size-24 shrink-0 place-items-center border-2 border-gold bg-accent font-display text-headline-lg uppercase text-band-ink sm:size-28 sm:text-display-hero-mobile"
              >
                {teamAbbr(team)}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-band-ink/20 pt-4 sm:grid-cols-2">
              <div>
                <span className="font-label-caps text-label-caps uppercase text-gold">
                  Próximo juego
                </span>
                <p className="mt-1 font-body text-body-md">
                  {next
                    ? `${opponent(next, team)} · ${formatScheduledStart(next.game.scheduledStart) ?? "Por confirmar"}`
                    : "Sin juego programado"}
                </p>
              </div>
              <div>
                <span className="font-label-caps text-label-caps uppercase text-gold">
                  Último resultado
                </span>
                <p className="mt-1 font-body text-body-md">
                  {last
                    ? `${opponent(last, team)} · ${score(last)} · ${side(last, team)}`
                    : "Sin resultados finales"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="club-games-title"
          className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8"
        >
          <SectionHeader
            id="club-games-title"
            kicker="Acta del club"
            title="Juegos del club"
            action={
              <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                {games.length} {games.length === 1 ? "registro" : "registros"}
              </span>
            }
          />

          {games.length === 0 ? (
            <p className="border border-line-strong bg-raised p-6 font-body text-body-md text-ink-muted">
              Sin juegos registrados para este club.
            </p>
          ) : (
            <div className="overflow-x-auto border border-line-strong bg-raised">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <caption className="sr-only">Juegos registrados de {team}</caption>
                <thead>
                  <tr className="border-b-2 border-band bg-table-head font-label-caps text-label-caps uppercase text-ink-muted">
                    <th scope="col" className="px-3 py-2">
                      Fecha
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Rival
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Condición
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Estado
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Marcador / inicio
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      Acta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((entry) => {
                    const status = gameStatus(entry);
                    const start = formatScheduledStart(entry.game.scheduledStart);
                    const startTime =
                      start && entry.game.scheduledStart
                        ? formatTime(entry.game.scheduledStart)
                        : null;
                    return (
                      <tr
                        key={entry.game.id}
                        className="border-b border-line bg-raised transition-colors even:bg-table-alt hover:bg-surface-low"
                      >
                        <td className="px-3 py-3 font-body text-body-sm text-ink-muted">
                          {start ?? "Sin fecha"}
                        </td>
                        <th
                          scope="row"
                          className="px-3 py-3 font-display text-title-md uppercase text-ink"
                        >
                          {opponent(entry, team)}
                        </th>
                        <td className="px-3 py-3 font-label-caps text-label-caps uppercase text-ink-muted">
                          {side(entry, team)}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-3 py-3 text-right font-display text-tabular-stats text-ink">
                          {status === "scheduled"
                            ? (startTime ?? "Por confirmar")
                            : score(entry)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/games/${entry.game.id}`}
                            aria-label={`Acta del juego ${shortGameId(entry.game.id)}`}
                            className="inline-flex items-center gap-1 font-label-caps text-label-caps uppercase text-accent transition-colors hover:text-ink"
                          >
                            Acta <Arrow />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}
