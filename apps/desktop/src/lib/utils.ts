/**
 * utils.ts — Shared non-React utilities.
 */

export function getTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}
