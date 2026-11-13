/**
 * RFC 9562 UUIDv7: 48-bit Unix milliseconds followed by random bits.
 *
 * The contract rejects v4 identifiers on purpose, so this is the only
 * identifier generator the scorer is allowed to use. Web Crypto works in the
 * browser, in a service worker and in Node 20+ without a Node-only polyfill.
 */
export function uuid7(now: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const timestamp = BigInt(Math.floor(now));

  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((timestamp >> BigInt(8 * (5 - i))) & 0xffn);
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
