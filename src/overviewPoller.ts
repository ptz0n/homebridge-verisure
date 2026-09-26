import type { Logger } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import {
  armStateOperation,
  climatesOperation,
  doorlocksOperation,
  doorWindowsOperation,
  overviewOperation,
  smartplugsOperation,
} from './operations';
import { OVERVIEW_CACHE_TTL_MS, RATE_LIMIT_BACKOFF_MS } from './settings';
import type { ArmState, Climate, DoorLockDevice, DoorWindow, Overview, SmartPlugDevice } from './types';
import { isGraphqlException, isRateLimited, isUnauthorized } from './types';

export type OverviewSubscriber = (overview: Overview) => void;

/**
 * Fetches and caches a single installation's overview, and drives the
 * scheduled poll tick that pushes fresh values to every accessory on that
 * installation.
 *
 * Centralizing this - instead of every accessory polling the API on its own
 * timer - is what keeps an installation with many accessories from making
 * many times the necessary number of requests per poll interval (a
 * significant contributor to the account rate-limit lockouts reported in
 * issues #173, #181, #168).
 */
export class OverviewPoller {
  private cache?: { value: Overview; time: number };

  private pending?: Promise<Overview>;

  private splitMode = false;

  private timer?: ReturnType<typeof setInterval>;

  private rateLimitedUntil = 0;

  private readonly subscribers = new Set<OverviewSubscriber>();

  constructor(
    private readonly installation: VerisureInstallation,
    private readonly log: Logger,
    private readonly pollIntervalMs: number
  ) {}

  subscribe(subscriber: OverviewSubscriber): void {
    this.subscribers.add(subscriber);
  }

  unsubscribe(subscriber: OverviewSubscriber): void {
    this.subscribers.delete(subscriber);
  }

  /** Starts the recurring poll tick. Callers that already have a fresh
   * overview (from discovery) should push it to accessories themselves
   * first - this deliberately doesn't fetch immediately, to avoid a
   * redundant back-to-back request on startup. */
  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Used by accessories for on-demand ("get") reads. Reuses the cached
   * overview when it's fresh enough instead of always fetching. */
  async getOverview(): Promise<Overview> {
    const now = Date.now();
    if (this.cache && now - this.cache.time < OVERVIEW_CACHE_TTL_MS) {
      return this.cache.value;
    }
    return this.fetch();
  }

  private async tick(): Promise<void> {
    if (Date.now() < this.rateLimitedUntil) {
      return;
    }
    try {
      const overview = await this.fetch();
      this.subscribers.forEach((subscriber) => {
        try {
          subscriber(overview);
        } catch (error) {
          // A single accessory choking on this overview (e.g. an unexpected
          // enum value) must not stop every other accessory on this
          // installation from being updated.
          this.log.debug(`${this.installation.config.alias}: A subscriber failed to process the latest overview: ${(error as Error).message}`);
        }
      });
    } catch (error) {
      if (isRateLimited(error)) {
        this.rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
        this.log.warn(`${this.installation.config.alias}: Verisure is rate-limiting this account. Pausing polling for ${Math.round(RATE_LIMIT_BACKOFF_MS / 60000)} minutes.`);
      } else if (isUnauthorized(error)) {
        this.log.error(`${this.installation.config.alias}: Verisure rejected our credentials (401). If you use "cookies" for MFA, they've likely expired - run "npx homebridge-verisure@latest" to get fresh ones.`);
      } else {
        this.log.warn(`${this.installation.config.alias}: Failed to poll for updates: ${(error as Error).message}`);
      }
      // Deliberately don't notify subscribers: accessories keep reporting
      // their last known state instead of appearing to go missing (#137).
    }
  }

  private fetch(): Promise<Overview> {
    if (!this.pending) {
      this.pending = this.fetchFresh().finally(() => {
        this.pending = undefined;
      });
    }
    return this.pending;
  }

  private async fetchFresh(): Promise<Overview> {
    const overview = this.splitMode ? await this.fetchSplit() : await this.fetchCombined();
    this.cache = { value: overview, time: Date.now() };
    return overview;
  }

  private async fetchCombined(): Promise<Overview> {
    try {
      const { installation } = await this.installation.client<{ installation: Overview }>(overviewOperation);
      return installation;
    } catch (error) {
      if (!isGraphqlException(error)) {
        throw error;
      }
      this.log.warn(`${this.installation.config.alias}: The combined overview query failed (${error.message}). Falling back to fetching each device type separately for this installation from now on.`);
      this.splitMode = true;
      return this.fetchSplit();
    }
  }

  private async fetchSplit(): Promise<Overview> {
    const [armState, climates, doorWindows, smartplugs, doorlocks] = await Promise.allSettled([
      this.querySingle<{ installation: { armState: ArmState | null } }>(armStateOperation),
      this.querySingle<{ installation: { climates: Climate[] | null } }>(climatesOperation),
      this.querySingle<{ installation: { doorWindows: DoorWindow[] | null } }>(doorWindowsOperation),
      this.querySingle<{ installation: { smartplugs: SmartPlugDevice[] | null } }>(smartplugsOperation),
      this.querySingle<{ installation: { doorlocks: DoorLockDevice[] | null } }>(doorlocksOperation),
    ]);

    return {
      armState: this.unwrap(armState, 'armState', 'installation.armState'),
      climates: this.unwrap(climates, 'climates', 'installation.climates'),
      doorWindows: this.unwrap(doorWindows, 'doorWindows', 'installation.doorWindows'),
      smartplugs: this.unwrap(smartplugs, 'smartplugs', 'installation.smartplugs'),
      doorlocks: this.unwrap(doorlocks, 'doorlocks', 'installation.doorlocks'),
    };
  }

  private querySingle<T>(operation: { operationName: string; variables?: Record<string, unknown>; query: string }): Promise<T> {
    return this.installation.client<T>(operation);
  }

  private unwrap<T>(
    result: PromiseSettledResult<Record<string, unknown>>,
    field: string,
    path: string
  ): T | undefined {
    if (result.status === 'rejected') {
      this.log.warn(`${this.installation.config.alias}: Could not fetch "${field}" for this installation: ${(result.reason as Error)?.message ?? result.reason}. Treating it as unavailable for this poll.`);
      return undefined;
    }
    const segments = path.split('.');
    let value: unknown = result.value;
    for (const segment of segments) {
      value = value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined;
    }
    return (value ?? undefined) as T | undefined;
  }
}
