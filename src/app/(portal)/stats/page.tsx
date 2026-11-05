import type { Metadata } from "next";
import Link from "next/link";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";
import { PortalLeaders } from "@/components/portal/leaders";
import { PortalOffline } from "@/components/portal/offline";
import { Arrow } from "@/components/portal/primitives";
import { SeasonSwitcher } from "@/components/portal/season-switcher";
import { PortalStandings } from "@/components/portal/standings";
import { fetchSeasonStatsPage } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Estadísticas",
  description:
    "Clasificación por competencia y líderes de bateo y pitcheo de la Liga Metropolitana de Open League Baseball.",
};

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const seasonParam = Array.isArray(params.season) ? params.season[0] : params.season;
  const { seasons, season, stats } = await fetchSeasonStatsPage(seasonParam);

  if (seasons.length === 0) {
    return (
      <>
        <PortalHeader active="stats" />
        <PortalOffline />
        <PortalFooter />
      </>
    );
  }

  return (
    <>
      <PortalHeader active="stats" />
      <main>
        <section aria-labelledby="stats-title" className="bg-band text-band-ink">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-accent px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink">
                Estadísticas de temporada
              </span>
              {season ? (
                <span className="font-label-caps text-label-caps uppercase text-band-muted">
                  {season.name} · {season.status === "active" ? "activa" : "archivada"}
                </span>
              ) : null}
            </div>

            <h1
              id="stats-title"
              className="mt-4 font-display text-display-hero-mobile uppercase sm:text-display-hero"
            >
              Estadísticas
            </h1>
            <p className="mt-4 max-w-3xl font-body text-body-md text-band-muted">
              Clasificación oficial por competencia y líderes individuales. Solo los juegos con
              acta completa suman estadísticas de jugadores; los resúmenes no aparecen en las
              tablas de bateo ni de pitcheo.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 font-label-caps text-label-caps uppercase">
              <Link
                href="#posiciones"
                className="text-gold transition-colors hover:text-band-ink"
              >
                Posiciones <Arrow />
              </Link>
              <Link href="#bateo" className="text-gold transition-colors hover:text-band-ink">
                Bateo <Arrow />
              </Link>
              <Link href="#pitcheo" className="text-gold transition-colors hover:text-band-ink">
                Pitcheo <Arrow />
              </Link>
            </div>
          </div>
        </section>

        <SeasonSwitcher seasons={seasons} activeId={season?.id ?? null} basePath="/stats" />

        {stats ? (
          <>
            <PortalStandings groups={stats.groups} />
            <div className="mx-auto w-full max-w-[1440px] px-4 pb-12 md:px-8">
              <PortalLeaders stats={stats} />
            </div>
          </>
        ) : (
          <div className="mx-auto w-full max-w-[1440px] px-4 py-10 md:px-8">
            <div className="border-l-4 border-accent bg-surface-low p-6">
              <span className="font-label-caps text-label-caps uppercase text-accent">
                Estadísticas no disponibles
              </span>
              <h2 className="mt-2 font-display text-headline-lg-mobile uppercase text-ink sm:text-headline-lg">
                La API no devolvió la temporada
              </h2>
              <p className="mt-3 max-w-2xl font-body text-body-md text-ink-muted">
                Sin la respuesta de{" "}
                <span className="font-mono">/seasons/:id/stats</span> no hay clasificación ni
                líderes que mostrar, y no se inventan filas.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-2 bg-band px-5 py-3 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:bg-accent"
              >
                Volver a la portada <Arrow />
              </Link>
            </div>
          </div>
        )}
      </main>
      <PortalFooter />
    </>
  );
}
