export interface Memoized<T> {
  (): Promise<T>;
  /** Discards the cached value, so the next call fetches fresh. Call this
   * right after a mutation that would make the cached value stale - see
   * OverviewPoller#invalidate for why this matters for HomeKit UX. */
  invalidate(): void;
}

/**
 * Wraps an async function so repeated calls within `ttlMs` reuse the same
 * result (and concurrent calls collapse into a single in-flight request)
 * instead of each hitting the network. Used to keep bursts of near-identical
 * HomeKit "get" requests from turning into a burst of Verisure API calls.
 */
export function memoizeAsync<T>(fn: () => Promise<T>, ttlMs: number): Memoized<T> {
  let cached: { value: T; time: number } | undefined;
  let pending: Promise<T> | undefined;

  const memoized = (): Promise<T> => {
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

  memoized.invalidate = (): void => {
    cached = undefined;
  };

  return memoized;
}
