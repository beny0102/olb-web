import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ScorePwaRegister } from "@/components/score/pwa-register";
import { SCORE_MANIFEST_PATH } from "@/lib/score";

export const metadata: Metadata = {
  title: {
    default: "Anotador",
    template: "%s · Anotador OLB",
  },
  description: "Anotador local de Open League Baseball.",
  manifest: SCORE_MANIFEST_PATH,
};

export const viewport: Viewport = {
  themeColor: "#111b31",
};

export default function ScoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-league="metropolitana" className="portal-shell min-h-dvh font-body">
      <header className="border-b border-line bg-band text-band-ink">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <span className="flex items-center gap-2 font-display text-headline-sm uppercase">
            <span className="size-2 bg-gold" aria-hidden="true" />
            Anotador
          </span>
          <Link
            href="/"
            className="font-label-caps text-label-caps uppercase text-band-muted transition-colors hover:text-band-ink"
          >
            ← Volver al portal
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface-low">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-8">
          <span className="font-label-caps text-label-caps uppercase text-ink-muted">
            F8.1 · shell de fusión del anotador
          </span>
          <Link href="/" className="font-label-caps text-label-caps uppercase text-ink-muted hover:text-ink">
            Volver al portal →
          </Link>
        </div>
      </footer>

      <ScorePwaRegister />
    </div>
  );
}
