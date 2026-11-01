import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-night/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Open League Baseball, inicio">
          <span className="grid size-9 place-items-center rounded-md border border-line bg-panel font-mono text-sm font-bold text-grass">
            OLB
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            Open League <span className="text-muted">Baseball</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-panel hover:text-chalk"
          >
            Juegos
          </Link>
          <Link
            href="/demo"
            className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-panel hover:text-chalk"
          >
            Demo
          </Link>
          <a
            href="https://github.com/beny0102/olb"
            className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-panel hover:text-chalk"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
