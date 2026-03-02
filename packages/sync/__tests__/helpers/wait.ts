/**
 * Polling helper that resolves as soon as the condition is met,
 * or rejects after a deterministic timeout.
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  { timeout = 10_000, interval = 200 } = {},
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await sleep(interval);
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
