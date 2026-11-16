/**
 * Compute a delay in seconds = base + random(0, jitter).
 * @param {number} baseSeconds
 * @param {number} jitterSeconds
 * @returns {number} total seconds (float)
 */
export function computeDelaySeconds(baseSeconds, jitterSeconds) {
  const base = Math.max(0, Number(baseSeconds) || 0);
  const jitter = Math.max(0, Number(jitterSeconds) || 0);
  return base + Math.random() * jitter;
}

/**
 * Sleep for the given number of seconds.
 * @param {number} seconds
 * @returns {Promise<void>}
 */
export function sleep(seconds) {
  const ms = Math.max(0, seconds) * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
