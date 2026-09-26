import { memoizeAsync } from './cache';

describe('memoizeAsync', () => {
  it('reuses the cached value within the TTL', async () => {
    const fn = jest.fn().mockResolvedValue('value');
    const memoized = memoizeAsync(fn, 1000);

    expect(await memoized()).toBe('value');
    expect(await memoized()).toBe('value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the TTL has elapsed', async () => {
    jest.useFakeTimers();
    const fn = jest.fn().mockResolvedValue('value');
    const memoized = memoizeAsync(fn, 1000);

    await memoized();
    jest.advanceTimersByTime(1001);
    await memoized();

    expect(fn).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('collapses concurrent calls into a single in-flight request', async () => {
    let resolveFn: (value: string) => void = () => {};
    const fn = jest.fn(() => new Promise<string>((resolve) => { resolveFn = resolve; }));
    const memoized = memoizeAsync(fn, 1000);

    const first = memoized();
    const second = memoized();
    resolveFn('value');

    expect(await first).toBe('value');
    expect(await second).toBe('value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rejection', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('value');
    const memoized = memoizeAsync(fn, 1000);

    await expect(memoized()).rejects.toThrow('boom');
    expect(await memoized()).toBe('value');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
