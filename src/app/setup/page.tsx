"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ADMIN_TOKEN_KEY } from "@/lib/admin";
import { AdminApiError, adminApiBase, login } from "@/lib/admin-api";
import {
  SETUP_PASSWORD_MIN_LENGTH,
  setupErrorMessage,
  setupStatus,
  slugify,
  submitSetup,
  validateSetupForm,
  type SetupErrors,
  type SetupField,
  type SetupFormValues,
} from "@/lib/setup";

type Phase = "loading" | "form" | "configured" | "unreachable" | "manual-login";

const EMPTY_FORM: SetupFormValues = {
  token: "",
  organizationName: "",
  organizationSlug: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  confirmPassword: "",
};

const INPUT =
  "min-h-12 w-full min-w-0 border border-line-strong bg-raised px-3 font-body text-body-md text-ink outline-none transition-colors focus:border-band aria-[invalid=true]:border-accent disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-ink-muted";
const LABEL = "font-label-caps text-label-caps uppercase text-ink-muted";
const BUTTON =
  "inline-flex min-h-12 items-center justify-center border-b-2 border-transparent bg-band px-6 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band-ink transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "inline-flex min-h-12 items-center justify-center border border-band px-6 font-body text-[12px] font-bold uppercase tracking-[0.08em] text-band transition-colors hover:bg-band hover:text-band-ink";

function Field({
  label,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  hintId?: string;
  error?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      <div className="min-w-0">{children}</div>
      {hint ? (
        <span id={hintId} className="font-body text-body-sm break-words text-ink-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="font-body text-body-sm text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Card({ accent, children }: { accent: "gold" | "crimson"; children: ReactNode }) {
  return (
    <section className="border border-line-strong bg-raised" data-testid="setup-card">
      <div className={accent === "gold" ? "h-1 bg-gold" : "h-1 bg-accent"} />
      <div className="p-5 md:p-8">{children}</div>
    </section>
  );
}

function ApiOrigin() {
  return (
    <p className="mt-4 font-body text-body-sm break-all text-ink-muted">
      API: <span className="font-mono">{adminApiBase()}</span>
    </p>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [values, setValues] = useState<SetupFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<SetupErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [statusAttempt, setStatusAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void setupStatus()
      .then((status) => {
        if (!active) return;
        setPhase(status.required ? "form" : "configured");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatusError(error instanceof AdminApiError ? error.message : setupErrorMessage(0));
        setPhase("unreachable");
      });
    return () => {
      active = false;
    };
  }, [statusAttempt]);

  function clearError(field: SetupField) {
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function update(field: SetupField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    clearError(field);
  }

  function updateOrganizationName(value: string) {
    setValues((current) => ({
      ...current,
      organizationName: value,
      organizationSlug: slugTouched ? current.organizationSlug : slugify(value),
    }));
    clearError("organizationName");
    clearError("organizationSlug");
  }

  function updateSlug(value: string) {
    setSlugTouched(true);
    update("organizationSlug", value);
  }

  function retryStatus() {
    setStatusError(null);
    setPhase("loading");
    setStatusAttempt((attempt) => attempt + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const nextErrors = validateSetupForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      await submitSetup(values);
      // The token is single-use: drop it (and the passwords) from state right away.
      setValues((current) => ({
        ...current,
        token: "",
        adminPassword: "",
        confirmPassword: "",
      }));

      try {
        const session = await login(values.adminEmail.trim(), values.adminPassword);
        try {
          window.localStorage.setItem(ADMIN_TOKEN_KEY, session.token);
        } catch {
          setPhase("manual-login");
          return;
        }
        router.replace("/admin");
      } catch {
        setPhase("manual-login");
      }
    } catch (error: unknown) {
      setMessage(error instanceof AdminApiError ? error.message : setupErrorMessage(0));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface font-body text-ink">
      <header className="bg-band text-band-ink">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-14">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="block h-1 w-10 bg-gold" />
            <span className="font-label-caps text-label-caps uppercase tracking-[0.08em] text-band-muted">
              Open League Baseball
            </span>
          </div>
          <h1 className="mt-4 font-display text-display-hero-mobile uppercase md:text-display-hero">
            Configuración inicial
          </h1>
          <p className="mt-3 max-w-2xl font-body text-body-md text-band-muted">
            Crea la organización de la liga y la primera cuenta de administración. Solo puede
            hacerse una vez por instalación.
          </p>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] md:items-start md:px-8 md:py-12">
        <aside className="order-2 md:order-1">
          <span className="font-label-caps text-label-caps uppercase text-accent">
            Primer arranque
          </span>
          <h2 className="mt-1 font-display text-headline-md uppercase text-ink">
            De cero a una liga operable
          </h2>
          <ol className="mt-5 border-t border-line">
            <li className="flex gap-4 border-b border-line py-4">
              <span className="font-display text-tabular-stats text-ink-muted">01</span>
              <div className="min-w-0">
                <p className="font-body text-body-md font-semibold text-ink">Organización</p>
                <p className="mt-1 font-body text-body-sm text-ink-muted">
                  Nombre e identificador público de la liga. El identificador aparece en las rutas
                  y no debería cambiar después.
                </p>
              </div>
            </li>
            <li className="flex gap-4 border-b border-line py-4">
              <span className="font-display text-tabular-stats text-ink-muted">02</span>
              <div className="min-w-0">
                <p className="font-body text-body-md font-semibold text-ink">Administrador</p>
                <p className="mt-1 font-body text-body-sm text-ink-muted">
                  La cuenta recibe el rol <span className="font-mono">org_admin</span> y administra
                  usuarios, catálogo, juegos y membresías.
                </p>
              </div>
            </li>
            <li className="flex gap-4 border-b border-line py-4">
              <span className="font-display text-tabular-stats text-ink-muted">03</span>
              <div className="min-w-0">
                <p className="font-body text-body-md font-semibold text-ink">Consola</p>
                <p className="mt-1 font-body text-body-sm text-ink-muted">
                  Al terminar entrarás en la consola para crear la temporada, los equipos y el
                  calendario.
                </p>
              </div>
            </li>
          </ol>
          <p className="mt-5 border-l-4 border-gold bg-surface-low px-3 py-2 font-body text-body-sm text-ink-muted">
            Esta página deja de aceptar cambios cuando existe la primera cuenta. Si ya está
            configurada, entra directamente en la consola.
          </p>
          <ApiOrigin />
        </aside>

        <div className="order-1 min-w-0 md:order-2">
          {phase === "loading" ? (
            <Card accent="gold">
              <div role="status" aria-live="polite" aria-busy="true">
                <span className="font-label-caps text-label-caps uppercase text-ink-muted">
                  Comprobando
                </span>
                <p className="mt-2 font-display text-headline-sm uppercase text-ink">
                  Consultando el estado de la liga…
                </p>
              </div>
            </Card>
          ) : null}

          {phase === "unreachable" ? (
            <Card accent="crimson">
              <div role="alert">
                <span className="font-label-caps text-label-caps uppercase text-accent">
                  Sin conexión
                </span>
                <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
                  No se pudo comprobar el estado
                </h2>
                <p className="mt-2 font-body text-body-sm text-ink-muted">{statusError}</p>
                <p className="mt-2 font-body text-body-sm break-all text-ink-muted">
                  API: <span className="font-mono">{adminApiBase()}</span>
                </p>
                <button type="button" onClick={retryStatus} className={`${SECONDARY} mt-5 w-full md:w-auto`}>
                  Reintentar
                </button>
              </div>
            </Card>
          ) : null}

          {phase === "configured" ? (
            <Card accent="gold">
              <div role="status">
                <span className="font-label-caps text-label-caps uppercase text-accent">
                  Configuración completada
                </span>
                <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
                  La liga ya está configurada
                </h2>
                <p className="mt-2 font-body text-body-sm text-ink-muted">
                  Esta instalación ya tiene una organización y una cuenta de administración. Inicia
                  sesión en la consola para gestionar la liga.
                </p>
                <Link href="/admin" className={`${BUTTON} mt-5 w-full md:w-auto`}>
                  Ir a la consola
                </Link>
              </div>
            </Card>
          ) : null}

          {phase === "manual-login" ? (
            <Card accent="gold">
              <div role="status">
                <span className="font-label-caps text-label-caps uppercase text-accent">
                  Configuración completada
                </span>
                <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
                  La liga quedó configurada
                </h2>
                <p className="mt-2 font-body text-body-sm text-ink-muted">
                  La organización y el administrador se crearon correctamente. Inicia sesión a mano
                  con{" "}
                  <span className="font-mono break-all">{values.adminEmail || "tu correo"}</span> y
                  la contraseña que elegiste.
                </p>
                <Link href="/admin" className={`${BUTTON} mt-5 w-full md:w-auto`}>
                  Iniciar sesión
                </Link>
              </div>
            </Card>
          ) : null}

          {phase === "form" ? (
            <Card accent="gold">
              <span className="font-label-caps text-label-caps uppercase text-accent">
                Datos de la liga
              </span>
              <h2 className="mt-1 font-display text-headline-sm uppercase text-ink">
                Crear organización y administrador
              </h2>
              <p className="mt-2 font-body text-body-sm text-ink-muted">
                Todos los campos son obligatorios. El token lo genera el servidor en el primer
                arranque.
              </p>

              <form
                data-testid="form-setup"
                noValidate
                onSubmit={handleSubmit}
                className="mt-6 space-y-5"
                aria-busy={pending}
              >
                <Field
                  label="Token de configuración"
                  htmlFor="setup-token"
                  hintId="setup-token-hint"
                  hint={
                    <>
                      Está en <span className="font-mono">deploy/.setup-token</span> (permisos 0600)
                      en el servidor o en la variable <span className="font-mono">SETUP_TOKEN</span>.
                    </>
                  }
                  error={errors.token}
                  errorId="setup-token-error"
                >
                  <input
                    id="setup-token"
                    name="token"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    aria-invalid={errors.token ? true : undefined}
                    aria-describedby={
                      errors.token ? "setup-token-hint setup-token-error" : "setup-token-hint"
                    }
                    value={values.token}
                    onChange={(event) => update("token", event.target.value)}
                    className={INPUT}
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Nombre de la liga"
                    htmlFor="setup-org-name"
                    error={errors.organizationName}
                    errorId="setup-org-name-error"
                  >
                    <input
                      id="setup-org-name"
                      name="organizationName"
                      type="text"
                      autoComplete="organization"
                      required
                      aria-invalid={errors.organizationName ? true : undefined}
                      aria-describedby={
                        errors.organizationName ? "setup-org-name-error" : undefined
                      }
                      value={values.organizationName}
                      onChange={(event) => updateOrganizationName(event.target.value)}
                      className={INPUT}
                      placeholder="Liga Metropolitana"
                    />
                  </Field>

                  <Field
                    label="Identificador de la liga"
                    htmlFor="setup-org-slug"
                    error={errors.organizationSlug}
                    errorId="setup-org-slug-error"
                  >
                    <input
                      id="setup-org-slug"
                      name="organizationSlug"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      aria-invalid={errors.organizationSlug ? true : undefined}
                      aria-describedby={
                        errors.organizationSlug ? "setup-org-slug-error" : undefined
                      }
                      value={values.organizationSlug}
                      onChange={(event) => updateSlug(event.target.value)}
                      className={INPUT}
                      placeholder="liga-metropolitana"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Nombre del administrador"
                    htmlFor="setup-admin-name"
                    error={errors.adminName}
                    errorId="setup-admin-name-error"
                  >
                    <input
                      id="setup-admin-name"
                      name="adminName"
                      type="text"
                      autoComplete="name"
                      required
                      aria-invalid={errors.adminName ? true : undefined}
                      aria-describedby={errors.adminName ? "setup-admin-name-error" : undefined}
                      value={values.adminName}
                      onChange={(event) => update("adminName", event.target.value)}
                      className={INPUT}
                    />
                  </Field>

                  <Field
                    label="Correo del administrador"
                    htmlFor="setup-admin-email"
                    error={errors.adminEmail}
                    errorId="setup-admin-email-error"
                  >
                    <input
                      id="setup-admin-email"
                      name="adminEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      aria-invalid={errors.adminEmail ? true : undefined}
                      aria-describedby={errors.adminEmail ? "setup-admin-email-error" : undefined}
                      value={values.adminEmail}
                      onChange={(event) => update("adminEmail", event.target.value)}
                      className={INPUT}
                      placeholder="admin@liga.olb"
                    />
                  </Field>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Contraseña"
                    htmlFor="setup-admin-password"
                    hint={`Mínimo ${SETUP_PASSWORD_MIN_LENGTH} caracteres.`}
                    hintId="setup-admin-password-hint"
                    error={errors.adminPassword}
                    errorId="setup-admin-password-error"
                  >
                    <input
                      id="setup-admin-password"
                      name="adminPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      required
                      aria-invalid={errors.adminPassword ? true : undefined}
                      aria-describedby={
                        errors.adminPassword
                          ? "setup-admin-password-hint setup-admin-password-error"
                          : "setup-admin-password-hint"
                      }
                      value={values.adminPassword}
                      onChange={(event) => update("adminPassword", event.target.value)}
                      className={INPUT}
                    />
                  </Field>

                  <Field
                    label="Confirmar contraseña"
                    htmlFor="setup-admin-password-confirm"
                    error={errors.confirmPassword}
                    errorId="setup-admin-password-confirm-error"
                  >
                    <input
                      id="setup-admin-password-confirm"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      required
                      aria-invalid={errors.confirmPassword ? true : undefined}
                      aria-describedby={
                        errors.confirmPassword ? "setup-admin-password-confirm-error" : undefined
                      }
                      value={values.confirmPassword}
                      onChange={(event) => update("confirmPassword", event.target.value)}
                      className={INPUT}
                    />
                  </Field>
                </div>

                {message ? (
                  <p
                    role="alert"
                    aria-live="assertive"
                    className="border-l-4 border-accent bg-accent-soft px-3 py-2 font-body text-body-sm text-ink"
                  >
                    {message}
                  </p>
                ) : null}

                <button type="submit" disabled={pending} className={`${BUTTON} w-full`}>
                  {pending ? "Configurando…" : "Crear liga y administrador"}
                </button>
              </form>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}
