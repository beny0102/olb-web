"use client";

import { useEffect, useRef, useState } from "react";

interface VerifierLinkProps {
  gameId: string;
}

/**
 * The absolute link a spotter opens on a second device. The origin is read in
 * an effect so server and client render the same placeholder first.
 */
export function VerifierLink({ gameId }: VerifierLinkProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/score/${encodeURIComponent(gameId)}/verify`);
  }, [gameId]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy(): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser without clipboard permission keeps the URL selectable.
    }
  }

  return (
    <section
      aria-label="Modo verificador"
      className="border border-line bg-raised px-space-md py-space-sm"
    >
      <p className="font-label-caps text-label-caps uppercase text-ink-muted">
        Modo verificador
      </p>
      <div className="mt-space-xs flex flex-wrap items-center justify-between gap-space-sm">
        {url ? (
          <a
            href={url}
            className="min-w-0 break-all font-body text-body-sm text-ink underline decoration-line-strong underline-offset-2 hover:text-accent"
          >
            {url}
          </a>
        ) : (
          <span className="min-w-0 break-all font-body text-body-sm text-ink-muted">
            Abriendo el enlace…
          </span>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!url}
          className="inline-flex min-h-12 items-center justify-center rounded-none border border-line-strong px-space-md font-label-caps text-label-caps uppercase text-ink hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </section>
  );
}
