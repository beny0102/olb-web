/* Service worker for the real scorer under /score. Registration scopes it there. */
const CACHE_VERSION = "v4";
const CACHE_NAME = `olb-score-shell-${CACHE_VERSION}`;
const SCORE_ROOT = "/score";
const SHELL_ASSETS = [
  SCORE_ROOT,
  "/score/new",
  "/score/manifest.webmanifest",
  "/score/icon.svg",
];
const OFFLINE_SHELL_MESSAGE = "olb-score-offline-shell";
const OFFLINE_SHELL_MARKER = "/score/__offline-shell";

function isScorePath(pathname) {
  return pathname === SCORE_ROOT || pathname.startsWith(`${SCORE_ROOT}/`);
}

function isCacheFirstAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/score/icons/") ||
    pathname === "/score/icon.svg" ||
    pathname === "/score/manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("olb-score-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function notifyOfflineShell(event) {
  const message = { type: OFFLINE_SHELL_MESSAGE };

  // The navigation request is handled before the page mounts, so the message
  // can be lost. The marker survives and the notice consumes it on startup.
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    new Request(new URL(OFFLINE_SHELL_MARKER, self.location.origin).href),
    new Response(String(Date.now()), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  );

  const client = event.clientId ? await self.clients.get(event.clientId) : null;
  if (client) {
    client.postMessage(message);
    return;
  }
  const clients = await self.clients.matchAll({ type: "window" });
  for (const entry of clients) entry.postMessage(message);
}

function offlineResponse() {
  return new Response(
    "Anotador sin conexión. Abre el juego una vez con red para guardar su shell.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

/**
 * Online it refreshes the cached HTML of every visited /score route. Offline it
 * serves that exact route when it was visited before; otherwise it falls back
 * to the cached /score shell and tells the page so the UI can explain why.
 */
async function networkFirstNavigation(event) {
  const request = event.request;
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const shell = await cache.match(SCORE_ROOT);
    if (shell) {
      // Write the marker before the document starts so the notice can read it.
      await notifyOfflineShell(event);
      return shell;
    }

    return offlineResponse();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return offlineResponse();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isCacheFirstAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Never intercept portal, admin or any other route outside /score.
  if (!isScorePath(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  event.respondWith(networkFirst(request));
});
