"use client";

import { useEffect, useState } from "react";
import {
  SCORE_OFFLINE_SHELL_EVENT,
  SCORE_OFFLINE_SHELL_MARKER,
  scoreCacheName,
} from "@/lib/score";

/**
 * Explains the offline state. The worker leaves a marker in the shell cache
 * when it had to serve the cached `/score` home instead of the requested game,
 * which only happens when that game was never opened online on this device.
 * The marker also covers the case where the worker message arrives before this
 * component mounts.
 */
async function consumeShellMarker(): Promise<boolean> {
  if (typeof caches === "undefined") return false;

  try {
    const cache = await caches.open(scoreCacheName());
    const markerUrl = new URL(SCORE_OFFLINE_SHELL_MARKER, location.origin).href;
    const marker = await cache.match(markerUrl);
    if (!marker) return false;
    await cache.delete(markerUrl);
    return true;
  } catch {
    return false;
  }
}

export function ScoreOfflineNotice() {
  const [offline, setOffline] = useState(false);
  const [shellFallback, setShellFallback] = useState(false);

  useEffect(() => {
    const worker = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    let mounted = true;

    function goOnline() {
      setOffline(false);
      setShellFallback(false);
    }

    function goOffline() {
      setOffline(true);
    }

    function onWorkerMessage(event: MessageEvent) {
      if (event.data?.type === SCORE_OFFLINE_SHELL_EVENT) setShellFallback(true);
    }

    setOffline(navigator.onLine === false);
    // `navigator.onLine` stays true when the network is unreachable, so the
    // marker is the reliable signal for an offline shell fallback.
    void consumeShellMarker().then((fellBack) => {
      if (mounted && fellBack) setShellFallback(true);
    });

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    worker?.addEventListener("message", onWorkerMessage);

    return () => {
      mounted = false;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      worker?.removeEventListener("message", onWorkerMessage);
    };
  }, []);

  if (!offline && !shellFallback) return null;

  return (
    <div
      role="status"
      className="border-b border-gold bg-band px-margin py-space-sm font-body text-body-sm text-band-ink"
    >
      {shellFallback
        ? "Sin conexión y este juego no se había abierto en este dispositivo. Se muestra el inicio guardado del anotador; abre el juego una vez con red para anotarlo sin conexión."
        : "Sin conexión. Las jugadas se guardan en este dispositivo."}
    </div>
  );
}
