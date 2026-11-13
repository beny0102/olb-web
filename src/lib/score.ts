export const SCORE_BASE_PATH = "/score";
export const SCORE_SW_PATH = "/score/sw.js";
export const SCORE_MANIFEST_PATH = "/score/manifest.webmanifest";
export const SCORE_ICON_PATH = "/score/icon.svg";

export const SCORE_CACHE_VERSION = "v4";

/** DOM event used by the registration component to update the status badge. */
export const SCORE_SW_EVENT = "olb-score-sw";

/** Message the worker posts when an offline navigation fell back to the shell. */
export const SCORE_OFFLINE_SHELL_EVENT = "olb-score-offline-shell";

/**
 * Cache entry the worker writes before serving the shell. A message alone is
 * lost when the page has not mounted its listener yet, so the notice also
 * consumes this marker on startup.
 */
export const SCORE_OFFLINE_SHELL_MARKER = "/score/__offline-shell";

/** Versioned cache name shared by the worker, the status badge and tests. */
export function scoreCacheName(version: string = SCORE_CACHE_VERSION): string {
  return `olb-score-shell-${version}`;
}

export const SCORE_CACHE_NAME = scoreCacheName();

/** Path of a single game inside the scorer. */
export function scoreGamePath(gameId: string): string {
  return `${SCORE_BASE_PATH}/${gameId}`;
}

/**
 * True only for the score area. Keeps `/scoreboard`, `/admin` and portal
 * routes out of the worker's scope checks.
 */
export function isScorePath(pathname: string): boolean {
  return pathname === SCORE_BASE_PATH || pathname.startsWith(`${SCORE_BASE_PATH}/`);
}
