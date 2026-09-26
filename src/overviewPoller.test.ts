import type { Logger } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import { OverviewPoller } from './overviewPoller';

const makeLogger = (): jest.Mocked<Logger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  success: jest.fn(),
} as unknown as jest.Mocked<Logger>);

const makeInstallation = (client: jest.Mock): VerisureInstallation => ({
  giid: 'abc123',
  locale: 'sv_SE',
  config: { giid: 'abc123', alias: 'Home', locale: 'sv_SE' },
  client,
}) as unknown as VerisureInstallation;

describe('OverviewPoller', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches the combined overview on the fast path', async () => {
    const client = jest.fn().mockResolvedValue({ installation: { armState: { statusType: 'DISARMED' } } });
    const poller = new OverviewPoller(makeInstallation(client), makeLogger(), 60000);

    const overview = await poller.getOverview();

    expect(overview.armState?.statusType).toBe('DISARMED');
    expect(client).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached overview for ad-hoc reads within the TTL', async () => {
    const client = jest.fn().mockResolvedValue({ installation: { armState: { statusType: 'DISARMED' } } });
    const poller = new OverviewPoller(makeInstallation(client), makeLogger(), 60000);

    await poller.getOverview();
    await poller.getOverview();

    expect(client).toHaveBeenCalledTimes(1);
  });

  it('falls back to per-device queries when the combined query fails, and remembers to for next time', async () => {
    const combinedError = Object.assign(new Error('GraphQL response contains 1 errors'), { name: 'GraphqlException', errors: [] });
    const client = jest.fn()
      .mockRejectedValueOnce(combinedError) // combined Overview
      .mockResolvedValueOnce({ installation: { armState: { statusType: 'ARMED_HOME' } } })
      .mockResolvedValueOnce({ installation: { climates: null } })
      .mockRejectedValueOnce(new Error('doorWindows exploded'))
      .mockResolvedValueOnce({ installation: { smartplugs: [] } })
      .mockResolvedValueOnce({ installation: { doorlocks: [] } });

    jest.useFakeTimers();
    const log = makeLogger();
    const poller = new OverviewPoller(makeInstallation(client), log, 1000);

    const overview = await poller.getOverview();

    expect(overview.armState?.statusType).toBe('ARMED_HOME');
    expect(overview.climates).toBeUndefined();
    expect(overview.doorWindows).toBeUndefined();
    expect(overview.smartplugs).toEqual([]);
    expect(overview.doorlocks).toEqual([]);
    expect(log.warn).toHaveBeenCalled();

    // Next fetch should go straight to split mode: 5 calls, not 6.
    client.mockClear();
    client
      .mockResolvedValueOnce({ installation: { armState: { statusType: 'DISARMED' } } })
      .mockResolvedValueOnce({ installation: { climates: [] } })
      .mockResolvedValueOnce({ installation: { doorWindows: [] } })
      .mockResolvedValueOnce({ installation: { smartplugs: [] } })
      .mockResolvedValueOnce({ installation: { doorlocks: [] } });

    // Cache TTL hasn't elapsed, but a fresh poll tick always forces a fetch.
    poller.start();
    await jest.advanceTimersByTimeAsync(1000);
    poller.stop();

    expect(client).toHaveBeenCalledTimes(5);
  });

  it('does not notify subscribers, but keeps polling, when a poll tick fails', async () => {
    jest.useFakeTimers();
    const client = jest.fn().mockRejectedValue(new Error('network down'));
    const log = makeLogger();
    const poller = new OverviewPoller(makeInstallation(client), log, 1000);
    const subscriber = jest.fn();
    poller.subscribe(subscriber);

    poller.start();
    await jest.advanceTimersByTimeAsync(1000);

    expect(subscriber).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
    poller.stop();
  });

  it('pauses polling for a while after a rate-limit response', async () => {
    jest.useFakeTimers();
    const rateLimitError = Object.assign(new Error('rate limited'), { isRateLimited: true });
    const client = jest.fn().mockRejectedValue(rateLimitError);
    const log = makeLogger();
    const poller = new OverviewPoller(makeInstallation(client), log, 1000);

    poller.start();
    await jest.advanceTimersByTimeAsync(1000);
    expect(client).toHaveBeenCalledTimes(1);

    // Next scheduled tick should be skipped entirely - still rate-limited.
    await jest.advanceTimersByTimeAsync(1000);
    expect(client).toHaveBeenCalledTimes(1);

    poller.stop();
  });

  it('keeps calling remaining subscribers when one of them throws', async () => {
    jest.useFakeTimers();
    const client = jest.fn().mockResolvedValue({ installation: { armState: { statusType: 'DISARMED' } } });
    const poller = new OverviewPoller(makeInstallation(client), makeLogger(), 1000);
    const failing = jest.fn(() => { throw new Error('boom'); });
    const healthy = jest.fn();
    poller.subscribe(failing);
    poller.subscribe(healthy);

    poller.start();
    await jest.advanceTimersByTimeAsync(1000);

    expect(failing).toHaveBeenCalled();
    expect(healthy).toHaveBeenCalled();
    poller.stop();
  });
});
