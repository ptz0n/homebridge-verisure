/**
 * Wraps an async function so repeated calls within `ttlMs` reuse the same
 * result (and concurrent calls collapse into a single in-flight request)
 * instead of each hitting the network. Used to keep bursts of near-identical
 * HomeKit "get" requests from turning into a burst of Verisure API calls.
 */
export function memoizeAsync<T>(fn: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let cached: { value: T; time: number } | undefined;
  let pending: Promise<T> | undefined;

  return (): Promise<T> => {
    const now = Date.now();
    if (cached && now - cached.time < ttlMs) {
      return Promise.resolve(cached.value);
    }
    if (!pending) {
      pending = fn()
        .then((value) => {
          cached = { value, time: Date.now() };
          return value;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  };
}
