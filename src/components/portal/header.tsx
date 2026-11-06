import Link from "next/link";

const NAV = [
  { href: "/", label: "Portada", match: "/" },
  { href: "#jornada", label: "Juegos", match: "#jornada" },
  { href: "/stats", label: "Estadísticas", match: "/stats" },
  { href: "/demo", label: "Demo", match: "/demo" },
  { href: "/admin", label: "Admin", match: "/admin" },
] as const;

function Shield() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-current">
      <path d="M12 2 4 5v6c0 5.2 3.4 9.1 8 11 4.6-1.9 8-5.8 8-11V5l-8-3Zm0 3.1 5 1.9V11c0 3.6-2.1 6.6-5 8.1-2.9-1.5-5-4.5-5-8.1V6.9l5-1.8Z" />
    </svg>
  );
}

function NavLinks({
  active,
  className,
}: {
  active: "portada" | "stats" | "admin" | null;
  className: string;
}) {
  return (
    <nav aria-label="Principal" data-portal-nav className={className}>
      {NAV.map((item) => {
        const isActive =
          (item.match === "/" && active === "portada") ||
          (item.match === "/stats" && active === "stats") ||
          (item.match === "/admin" && active === "admin");
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "bg-band px-3 py-2 font-label-caps text-label-caps uppercase text-band-ink"
                : "px-3 py-2 font-label-caps text-label-caps uppercase text-ink-muted transition-colors hover:bg-surface-low hover:text-ink"
            }
          >
            {item.label}
          </Link>
        );
      })}
      <a
        href="https://github.com/beny0102/olb"
        rel="noreferrer"
        target="_blank"
        className="px-3 py-2 font-label-caps text-label-caps uppercase text-ink-muted transition-colors hover:bg-surface-low hover:text-ink"
      >
        Whitepaper ↗
      </a>
    </nav>
  );
}

export function PortalHeader({
  active = "portada",
}: {
  active?: "portada" | "stats" | "admin" | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Liga Metropolitana, portada">
            <span className="grid size-10 shrink-0 place-items-center bg-band text-gold">
              <Shield />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-headline-sm uppercase text-ink">
                Liga Metropolitana
              </span>
              <span className="mt-1 block truncate font-label-caps text-label-caps uppercase text-ink-muted">
                Open League Baseball · registro abierto
              </span>
            </span>
          </Link>

          <NavLinks active={active} className="hidden items-center gap-1 lg:flex" />

          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <a
              href="https://github.com/beny0102/olb-contract"
              rel="noreferrer"
              target="_blank"
              className="inline-flex items-center border-b-2 border-transparent bg-band px-4 py-2 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent"
            >
              Contrato 0.1.0
            </a>
            <span className="inline-flex items-center gap-1.5 border border-line-strong px-2 py-1 font-label-caps text-label-caps uppercase text-ink">
              <span className="size-1.5 bg-accent" />
              Acta abierta
            </span>
          </div>
        </div>

        <NavLinks active={active} className="flex items-center gap-1 overflow-x-auto pb-2 lg:hidden" />
      </div>
    </header>
  );
}
