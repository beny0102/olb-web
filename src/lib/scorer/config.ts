/**
 * Origin of the public viewer. Empty by default so viewer links stay on the
 * same origin and point at the portal game page (`/games/<id>`). Set
 * `NEXT_PUBLIC_VIEWER_URL` when the viewer runs on another host.
 */
export const VIEWER_URL = (process.env.NEXT_PUBLIC_VIEWER_URL ?? "").replace(/\/$/, "");
