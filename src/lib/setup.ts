import { adminErrorMessage } from "./admin";
import { AdminApiError, adminApiBase } from "./admin-api";

/**
 * Browser-only client for the first-run setup routes.
 * `NEXT_PUBLIC_API_URL` is inlined at build time; no server-only imports.
 */
const TIMEOUT_MS = 8000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SETUP_PASSWORD_MIN_LENGTH = 10;

export interface SetupStatus {
  required: boolean;
}

export interface SetupFormValues {
  token: string;
  organizationName: string;
  organizationSlug: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}

export type SetupField = keyof SetupFormValues;
export type SetupErrors = Partial<Record<SetupField, string>>;

interface SetupRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

function readJson(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: SetupRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${adminApiBase()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "TimeoutError";
    throw new AdminApiError(
      0,
      timedOut
        ? "La API tardó demasiado en responder. Inténtalo de nuevo."
        : setupErrorMessage(0),
    );
  }

  const payload = readJson(await response.text());
  if (!response.ok) {
    throw new AdminApiError(response.status, setupErrorMessage(response.status));
  }
  return payload as T;
}

export async function setupStatus(): Promise<SetupStatus> {
  const payload = await request<SetupStatus | null>("/setup/status");
  return { required: payload?.required === true };
}

export async function submitSetup(values: SetupFormValues): Promise<void> {
  await request<unknown>("/setup", { method: "POST", body: setupPayload(values) });
}

function setupPayload(values: SetupFormValues): unknown {
  return {
    token: values.token.trim(),
    organization: {
      name: values.organizationName.trim(),
      slug: values.organizationSlug.trim(),
    },
    admin: {
      name: values.adminName.trim(),
      email: values.adminEmail.trim(),
      password: values.adminPassword,
    },
  };
}

/** Lowercase kebab-case identifier: strips accents and collapses punctuation. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateSetupForm(values: SetupFormValues): SetupErrors {
  const errors: SetupErrors = {};

  if (values.token.trim().length === 0) {
    errors.token = "El token de configuración es obligatorio.";
  }

  if (values.organizationName.trim().length === 0) {
    errors.organizationName = "El nombre de la liga es obligatorio.";
  }

  const slug = values.organizationSlug.trim();
  if (slug.length === 0) {
    errors.organizationSlug = "El identificador de la liga es obligatorio.";
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.organizationSlug =
      "Usa minúsculas, números y guiones, sin empezar ni acabar en guion.";
  }

  if (values.adminName.trim().length === 0) {
    errors.adminName = "El nombre del administrador es obligatorio.";
  }

  const email = values.adminEmail.trim();
  if (email.length === 0) {
    errors.adminEmail = "El correo es obligatorio.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.adminEmail = "Escribe un correo válido.";
  }

  if (values.adminPassword.length < SETUP_PASSWORD_MIN_LENGTH) {
    errors.adminPassword = `La contraseña debe tener al menos ${SETUP_PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (values.confirmPassword !== values.adminPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return errors;
}

/** Spanish copy for setup failures. The API speaks English. */
export function setupErrorMessage(status: number): string {
  switch (status) {
    case 0:
      return "No se pudo conectar con la API. Comprueba que esté en marcha y que la URL sea correcta.";
    case 400:
      return "La API rechazó los datos. Revisa los campos del formulario.";
    case 401:
      return "Token de configuración inválido.";
    case 409:
      return "La liga ya está configurada. Inicia sesión en la consola.";
    case 429:
      return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
    default:
      return adminErrorMessage(status);
  }
}
