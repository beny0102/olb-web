import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SETUP_PASSWORD_MIN_LENGTH,
  setupErrorMessage,
  setupStatus,
  slugify,
  submitSetup,
  validateSetupForm,
  type SetupFormValues,
} from "@/lib/setup";

const VALID: SetupFormValues = {
  token: "token-de-instalacion",
  organizationName: "Liga Metropolitana",
  organizationSlug: "liga-metropolitana",
  adminName: "Ana Pérez",
  adminEmail: "ana@liga.olb",
  adminPassword: "0123456789",
  confirmPassword: "0123456789",
};

function form(overrides: Partial<SetupFormValues> = {}): SetupFormValues {
  return { ...VALID, ...overrides };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("Liga Metropolitana")).toBe("liga-metropolitana");
    expect(slugify("  Fuerza   Bruta  ")).toBe("fuerza-bruta");
  });

  it("strips accents and handles eñe", () => {
    expect(slugify("Águilas del Ñandú")).toBe("aguilas-del-nandu");
    expect(slugify("ÁÉÍÓÚ Ü")).toBe("aeiou-u");
  });

  it("turns punctuation into hyphens and collapses runs", () => {
    expect(slugify("Tigres__2026!!")).toBe("tigres-2026");
    expect(slugify("Fuerza--Bruta")).toBe("fuerza-bruta");
    expect(slugify("-Guiones-")).toBe("guiones");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugify("   ")).toBe("");
    expect(slugify("¡!¿?")).toBe("");
  });
});

describe("validateSetupForm", () => {
  it("accepts a complete valid form", () => {
    expect(validateSetupForm(VALID)).toEqual({});
  });

  it("requires every field", () => {
    const errors = validateSetupForm({
      token: " ",
      organizationName: "",
      organizationSlug: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      confirmPassword: "",
    });

    expect(Object.keys(errors)).toHaveLength(6);
    expect(errors.token).toContain("obligatorio");
    expect(errors.organizationName).toContain("obligatorio");
    expect(errors.organizationSlug).toContain("obligatorio");
    expect(errors.adminName).toContain("obligatorio");
    expect(errors.adminEmail).toContain("obligatorio");
    expect(errors.adminPassword).toContain("10");
  });

  it("rejects slugs that are not lowercase kebab-case", () => {
    for (const slug of ["Liga Metropolitana", "Liga", "-liga", "liga-", "liga--metro", "liga_metro"]) {
      expect(validateSetupForm(form({ organizationSlug: slug })).organizationSlug).toBeTruthy();
    }
    expect(validateSetupForm(form({ organizationSlug: "liga-2026" })).organizationSlug).toBeUndefined();
  });

  it("rejects an email without a valid shape", () => {
    expect(validateSetupForm(form({ adminEmail: "sin-arroba" })).adminEmail).toBeTruthy();
    expect(validateSetupForm(form({ adminEmail: "ana@liga" })).adminEmail).toBeTruthy();
    expect(validateSetupForm(form({ adminEmail: " ana@liga.olb " })).adminEmail).toBeUndefined();
  });

  it(`requires at least ${SETUP_PASSWORD_MIN_LENGTH} password characters`, () => {
    expect(
      validateSetupForm(form({ adminPassword: "123456789", confirmPassword: "123456789" }))
        .adminPassword,
    ).toBeTruthy();
    expect(
      validateSetupForm(form({ adminPassword: "1234567890", confirmPassword: "1234567890" }))
        .adminPassword,
    ).toBeUndefined();
  });

  it("requires the confirmation to match exactly", () => {
    expect(validateSetupForm(form({ confirmPassword: "otra-clave" })).confirmPassword).toBeTruthy();
  });
});

describe("setupErrorMessage", () => {
  it("maps the documented setup failures to Spanish copy", () => {
    expect(setupErrorMessage(0)).toContain("conectar");
    expect(setupErrorMessage(400)).toContain("datos");
    expect(setupErrorMessage(401)).toContain("Token");
    expect(setupErrorMessage(409)).toContain("ya está configurada");
    expect(setupErrorMessage(429)).toContain("Demasiados intentos");
  });

  it("falls back to the shared admin message for unexpected statuses", () => {
    expect(setupErrorMessage(500)).toContain("API");
    expect(setupErrorMessage(418)).toContain("418");
  });
});

describe("setupStatus", () => {
  it("asks /setup/status and returns whether setup is required", async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ required: true }));

    await expect(setupStatus()).resolves.toEqual({ required: true });

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as [string, RequestInit];
    expect(url.endsWith("/setup/status")).toBe(true);
    expect(init.method).toBe("GET");
  });

  it("reports false when the league already exists", async () => {
    stubFetch(async () => jsonResponse({ required: false }));
    await expect(setupStatus()).resolves.toEqual({ required: false });
  });
});

describe("submitSetup", () => {
  it("posts the trimmed payload and resolves on 201", async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ organization: {} }, 201));

    await submitSetup(
      form({
        token: "  secreto  ",
        organizationName: "  Liga  ",
        organizationSlug: " liga ",
        adminName: " Ana ",
        adminEmail: " ana@liga.olb ",
      }),
    );

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as [string, RequestInit];
    expect(url.endsWith("/setup")).toBe(true);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      token: "secreto",
      organization: { name: "Liga", slug: "liga" },
      admin: { name: "Ana", email: "ana@liga.olb", password: "0123456789" },
    });
  });

  it("rejects with a mapped error for 401, 409 and 429", async () => {
    for (const status of [401, 409, 429]) {
      stubFetch(async () => jsonResponse({ message: "no" }, status));
      await expect(submitSetup(VALID)).rejects.toMatchObject({
        status,
        message: setupErrorMessage(status),
      });
      vi.unstubAllGlobals();
    }
  });

  it("rejects with status 0 when the API cannot be reached", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(submitSetup(VALID)).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("conectar"),
    });
  });
});
