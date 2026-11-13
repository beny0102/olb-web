"use client";

import { useEffect, useState } from "react";
import { SCORE_CACHE_NAME, SCORE_SW_EVENT } from "@/lib/score";

type SwStatus = "pending" | "offline-ready" | "active" | "unsupported" | "error";

const LABELS: Record<SwStatus, string> = {
  pending: "Service worker pendiente",
  "offline-ready": "Offline listo",
  active: "Service worker activo",
  unsupported: "Sin soporte de service worker",
  error: "Error de service worker",
};

const TONES: Record<SwStatus, string> = {
  pending: "border-line-strong bg-surface-raised text-ink-muted",
  "offline-ready": "border-gold bg-band text-band-ink",
  active: "border-line-strong bg-surface-raised text-ink",
  unsupported: "border-line-strong bg-surface-low text-ink-muted",
  error: "border-accent bg-accent-soft text-ink",
};

export function ScoreSwStatus() {
  const [status, setStatus] = useState<SwStatus>("pending");

  useEffect(() => {
    let cancelled = false;
    const supported = "serviceWorker" in navigator;

    async function refresh() {
      if (!supported) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      const controlled = Boolean(navigator.serviceWorker.controller);
      let cached = false;

      try {
        cached = typeof caches !== "undefined" && (await caches.has(SCORE_CACHE_NAME));
      } catch {
        cached = false;
      }

      if (cancelled) return;
      setStatus(controlled && cached ? "offline-ready" : controlled ? "active" : "pending");
    }

    function onScoreWorkerEvent(event: Event) {
      const state = (event as CustomEvent<{ state?: string }>).detail?.state;
      if (state === "error") {
        setStatus("error");
        return;
      }
      if (state === "unsupported") {
        setStatus("unsupported");
        return;
      }
      void refresh();
    }

    void refresh();

    if (supported) {
      navigator.serviceWorker.addEventListener("controllerchange", refresh);
    }
    window.addEventListener(SCORE_SW_EVENT, onScoreWorkerEvent);
    window.addEventListener("online", refresh);

    return () => {
      cancelled = true;
      if (supported) {
        navigator.serviceWorker.removeEventListener("controllerchange", refresh);
      }
      window.removeEventListener(SCORE_SW_EVENT, onScoreWorkerEvent);
      window.removeEventListener("online", refresh);
    };
  }, []);

  return (
    <p
      data-sw-status={status}
      role="status"
      className={`inline-flex items-center gap-2 border px-2 py-1 font-label-caps text-label-caps uppercase ${TONES[status]}`}
    >
      <span className={`size-1.5 ${status === "offline-ready" ? "bg-gold" : status === "error" ? "bg-accent" : "bg-ink-muted"}`} />
      {LABELS[status]}
    </p>
  );
}
