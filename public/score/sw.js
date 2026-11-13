/* Service worker for the scorer shell. Scoped to /score by registration. */
const CACHE_VERSION = "v1";
const CACHE_NAME = `olb-score-shell-${CACHE_VERSION}`;
const SCORE_ROOT = "/score";
const SHELL_ASSETS = [SCORE_ROOT, "/score/manifest.webmanifest", "/score/icon.svg"];

function isScorePath(pathname) {
  return pathname === SCORE_ROOT || pathname.startsWith(`${SCORE_ROOT}/`);
}

function isCacheFirstAsset(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/score/icons/") || pathname === "/score/icon.svg";
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      const shell = await cache.match(SCORE_ROOT);
      if (shell) return shell;
    }

    return new Response("Anotador sin conexión. Recarga con red para preparar el shell.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
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

  // Never intercept portal or admin routes.
  if (!isScorePath(url.pathname)) return;

  event.respondWith(networkFirst(request));
});
