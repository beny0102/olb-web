import { LiveGame } from "@/components/live-game";
import { PortalFooter } from "@/components/portal/footer";
import { PortalHeader } from "@/components/portal/header";
import { demoBundle } from "@/lib/demo";

export const metadata = {
  title: "Demostración",
  description: "Juego de demostración con datos sintéticos, sin backend.",
};

export default function DemoPage() {
  return (
    <>
      <PortalHeader active={null} />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8">
        <div className="flex flex-col gap-6">
          <div className="border-l-4 border-accent bg-surface-low p-4">
            <p className="font-label-caps text-label-caps uppercase text-accent">
              Demostración estática
            </p>
            <p className="mt-2 max-w-2xl font-body text-body-sm leading-relaxed text-ink-muted">
              Este juego se reproduce desde un registro de eventos embebido. No hay backend ni
              cámaras: el marcador sale de los eventos y la trayectoria del pitcheo es sintética.
            </p>
          </div>

          <LiveGame
            game={demoBundle.game}
            initialState={demoBundle.state}
            initialEvents={demoBundle.events}
            demo
          />
        </div>
      </main>
      <PortalFooter />
    </>
  );
}
