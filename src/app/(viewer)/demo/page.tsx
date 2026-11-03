import { LiveGame } from "@/components/live-game";
import { demoBundle } from "@/lib/demo";

export const metadata = {
  title: "Demostración",
  description: "Juego de demostración con datos sintéticos, sin backend.",
};

export default function DemoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="panel border-ember/30 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember">
          Demostración estática
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
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
  );
}
