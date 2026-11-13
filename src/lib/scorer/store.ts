import { IndexedDbGameStore } from "./db";

let store: IndexedDbGameStore | null = null;

/**
 * The browser store singleton. Call it from effects and event handlers, never
 * during a server render: `IndexedDB` only exists in the browser.
 */
export function localStore(): IndexedDbGameStore {
  store ??= new IndexedDbGameStore();
  return store;
}
