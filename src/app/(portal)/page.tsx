import type { Metadata } from "next";
import { PortalFeaturedGame } from "@/components/portal/featured-game";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";
import { PortalLedger } from "@/components/portal/ledger";
import { PortalOffline } from "@/components/portal/offline";
import { PortalPatrimony } from "@/components/portal/patrimony";
import { PortalScoreCards } from "@/components/portal/score-cards";
import { PortalSlate } from "@/components/portal/slate";
import { PortalStatusBar } from "@/components/portal/status-bar";
import { PortalTicker } from "@/components/portal/ticker";
import { fetchPortalData, selectFeatured } from "@/lib/league";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portada",
  description:
    "Portada de la Liga Metropolitana de Open League Baseball: jornada, actas, marcadores en vivo y registro abierto.",
};

export default async function PortalPage() {
  const data = await fetchPortalData();

  if (!data) {
    return (
      <>
        <PortalHeader />
        <PortalOffline />
        <PortalFooter />
      </>
    );
  }

  return (
    <>
      <PortalHeader />
      <main>
        <PortalTicker games={data.games} />
        <PortalStatusBar gameCount={data.games.length} fetchedAt={data.fetchedAt} health={data.health} />
        <PortalScoreCards games={data.games} />
        <PortalFeaturedGame entry={selectFeatured(data.games)} />
        <PortalSlate games={data.games} />
        <PortalLedger games={data.games} />
        <PortalPatrimony />
      </main>
      <PortalFooter />
    </>
  );
}
