"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ONBOARDING_DISMISSED_KEY,
  onboardingChecklist,
  onboardingReady,
  type OnboardingData,
  type OnboardingItem,
} from "@/lib/admin-transfer";

function ChecklistLink({ item }: { item: OnboardingItem }) {
  const className =
    "font-label-caps text-label-caps uppercase text-accent underline decoration-1 underline-offset-4 transition-colors hover:text-ink";
  if (item.href.startsWith("#")) {
    return (
      <a href={item.href} className={className}>
        {item.done ? "Revisar" : "Ir al paso"}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className}>
      {item.done ? "Revisar" : "Ir al paso"}
    </Link>
  );
}

export function OnboardingChecklist({ data }: { data: OnboardingData }) {
  const [dismissed, setDismissed] = useState(false);
  const items = onboardingChecklist(data);
  const ready = onboardingReady(items);
  const pending = items.filter((item) => !item.done);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    try {
      window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    } catch {
      // Storage can be unavailable in private mode; dismiss for this render.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  if (ready) {
    return (
      <section
        data-testid="onboarding-ready"
        className="mb-6 flex flex-wrap items-center gap-3 border border-line-strong border-l-4 border-l-gold bg-raised px-4 py-3"
      >
        <span className="font-label-caps text-label-caps uppercase text-accent">
          Puesta en marcha
        </span>
        <p className="font-display text-headline-sm uppercase text-ink">
          Liga lista para operar
        </p>
        <span className="font-body text-body-sm text-ink-muted">
          {pending.length > 0
            ? `Recomendado: ${pending.map((item) => item.label.toLowerCase()).join(", ")}.`
            : "Todos los pasos están completos."}
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-auto min-h-9 border border-line-strong px-3 font-label-caps text-label-caps uppercase text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Ocultar
        </button>
      </section>
    );
  }

  return (
    <section
      data-testid="onboarding-checklist"
      className="mb-6 border border-line-strong bg-raised"
    >
      <div className="h-1 bg-band" />
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-label-caps text-label-caps uppercase text-accent">
              Puesta en marcha
            </span>
            <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
              Prepara la liga
            </h2>
            <p className="mt-1 font-body text-body-sm text-ink-muted">
              Pasos mínimos para poder programar y anotar juegos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="min-h-9 border border-line-strong px-3 font-label-caps text-label-caps uppercase text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            Ocultar
          </button>
        </div>
        <ol className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-start gap-3 border-t border-line pt-3"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border font-label-caps text-label-caps ${
                  item.done
                    ? "border-band bg-band text-band-ink"
                    : "border-line-strong text-ink-muted"
                }`}
              >
                {item.done ? "OK" : index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-body text-body-sm font-semibold text-ink">
                  {item.label}
                  {!item.required ? (
                    <span className="ml-2 font-label-caps text-label-caps uppercase text-gold">
                      Recomendado
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 font-body text-body-sm text-ink-muted">{item.detail}</p>
                <div className="mt-1 flex items-center gap-3">
                  <span
                    className={`font-label-caps text-label-caps uppercase ${
                      item.done ? "text-ink-muted" : "text-accent"
                    }`}
                  >
                    {item.done ? "Hecho" : "Pendiente"}
                  </span>
                  <ChecklistLink item={item} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
