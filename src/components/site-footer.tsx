export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Open League Baseball · proyecto abierto, sin afiliación con MLB ni con Gameday.
        </p>
        <p className="font-mono">
          Apache-2.0 · contrato <span className="text-chalk">olb.event/1</span>
        </p>
      </div>
    </footer>
  );
}
