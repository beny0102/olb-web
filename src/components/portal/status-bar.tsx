import { CONTRACT_VERSION, formatTime } from "@/lib/league";
import type { HealthRecord } from "@/lib/api";

const STORAGE_LABEL: Record<string, string> = {
  memory: "memoria",
  postgres: "postgres",
  demo: "demo",
};

/** Never leak a raw English storage backend into the portal copy. */
function storageLabel(storage: string): string {
  return STORAGE_LABEL[storage] ?? storage;
}

export function PortalStatusBar({
  gameCount,
  fetchedAt,
  health,
}: {
  gameCount: number;
  fetchedAt: string;
  health: HealthRecord | null;
}) {
  return (
    <section aria-label="Estado del registro" className="border-b-2 border-accent bg-band text-band-ink">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-2 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 bg-accent px-2 py-1 font-label-caps text-label-caps uppercase text-band-ink">
            <span className="size-1.5 bg-band-ink" />
            Directriz oficial
          </span>
          <p className="min-w-0 font-body text-body-sm text-band-muted">
            <span className="font-bold uppercase text-band-ink">Registro oficial</span> ·{" "}
            {gameCount} {gameCount === 1 ? "juego" : "juegos"} · contrato {CONTRACT_VERSION} ·
            actualizado {formatTime(fetchedAt)}
          </p>
        </div>
        <span className="shrink-0 font-label-caps text-label-caps uppercase text-gold">
          Fuente: olb-api{health ? ` · ${storageLabel(health.storage)}` : ""}
        </span>
      </div>
    </section>
  );
}
