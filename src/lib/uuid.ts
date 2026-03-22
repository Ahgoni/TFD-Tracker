/**
 * UUID v4 generator that works in both secure (HTTPS) and insecure (HTTP) contexts.
 * crypto.randomUUID() is only available on HTTPS in browsers, so we fall back to
 * Math.random()-based generation when it isn't available.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
