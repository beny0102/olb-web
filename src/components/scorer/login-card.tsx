"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/scorer/api";
import { useAuth } from "./auth-provider";

const FIELD_CLASS =
  "mt-space-xs min-h-12 w-full rounded-none border border-line-strong bg-surface px-space-sm font-body text-body-md text-ink placeholder:text-ink-muted focus:border-accent";

const LABEL_CLASS =
  "block font-label-caps text-label-caps uppercase text-ink-muted";

/** Email/password login. The local game list stays usable without a session. */
export function LoginCard() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "No pudimos iniciar sesión. Inténtalo de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="login-heading"
      className="border border-line-strong bg-raised"
    >
      <header className="border-b border-line px-space-md py-space-sm">
        <h2 id="login-heading" className="font-display text-headline-sm text-ink">
          Entrar a la liga
        </h2>
        <p className="mt-space-xs font-body text-body-sm text-ink-muted">
          Inicia sesión para ver los juegos programados de tu equipo. Los juegos
          de este dispositivo siguen disponibles sin conexión.
        </p>
      </header>

      <form
        onSubmit={(event) => void submit(event)}
        className="space-y-space-md px-space-md py-space-md"
      >
        <label className={LABEL_CLASS}>
          Correo
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
            placeholder="tu@equipo.olb"
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            className={FIELD_CLASS}
          />
        </label>

        {error ? (
          <p
            role="alert"
            className="border-l-4 border-accent bg-accent-soft px-space-sm py-space-sm font-body text-body-md text-ink"
          >
            {error}
          </p>
        ) : null}

        <p className="font-body text-body-sm text-ink-muted">
          Demo: tiburones@liga-metropolitana.olb · olb-demo-tiburones
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-none border border-accent bg-accent px-space-lg font-label-caps text-label-caps uppercase text-band-ink hover:bg-band disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </section>
  );
}
