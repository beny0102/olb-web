"use client";

import { useEffect } from "react";
import { isScorePath, SCORE_SW_EVENT, SCORE_SW_PATH } from "@/lib/score";

type SwState = "registered" | "unsupported" | "error";

function emit(state: SwState, message?: string) {
  window.dispatchEvent(
    new CustomEvent<{ state: SwState; message?: string }>(SCORE_SW_EVENT, {
      detail: { state, message },
    }),
  );
}

/**
 * Registers the scorer worker only while the app is inside /score.
 * Portal pages never mount this component and never install a worker.
 */
export function ScorePwaRegister() {
  useEffect(() => {
    if (!isScorePath(window.location.pathname)) return;

    if (!("serviceWorker" in navigator)) {
      emit("unsupported");
      return;
    }

    let cancelled = false;

    async function register() {
      try {
        await navigator.serviceWorker.register(SCORE_SW_PATH, { scope: "/score" });
        if (!cancelled) emit("registered");
      } catch (error) {
        if (!cancelled) {
          emit("error", error instanceof Error ? error.message : "No se pudo registrar el service worker.");
        }
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
