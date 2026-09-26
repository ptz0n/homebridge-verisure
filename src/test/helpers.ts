import * as hap from '@homebridge/hap-nodejs';
import type { API, Logger, PlatformAccessory } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import type { AccessoryContext } from '../accessories/base';
import { VerisurePlatform } from '../platform';
import type { VerisurePlatformConfig } from '../types';

/** Homebridge's own `PlatformAccessory` class is only exported as a type, not
 * a value (plugins only ever receive already-constructed instances via
 * `api.platformAccessory`). For tests, this thin shim over a real hap-nodejs
 * `Accessory` provides everything the accessory handlers actually use
 * (context, displayName, addService/getService/getServiceById), backed by
 * real Service/Characteristic objects so onGet/onSet wiring can be exercised
 * end-to-end. */
class TestPlatformAccessory<T> {
  private readonly hapAccessory: InstanceType<typeof hap.Accessory>;

  context: T = {} as T;

  constructor(public displayName: string, public UUID: string) {
    this.hapAccessory = new hap.Accessory(displayName, UUID);
  }

  get services() {
    return this.hapAccessory.services;
  }

  addService(...args: Parameters<typeof this.hapAccessory.addService>) {
    return this.hapAccessory.addService(...args);
  }

  getService(...args: Parameters<typeof this.hapAccessory.getService>) {
    return this.hapAccessory.getService(...args);
  }

  getServiceById(...args: Parameters<typeof this.hapAccessory.getServiceById>) {
    return this.hapAccessory.getServiceById(...args);
  }
}

export const makeLogger = (): jest.Mocked<Logger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  success: jest.fn(),
} as unknown as jest.Mocked<Logger>);

export const makeApi = (): jest.Mocked<API> => ({
  hap,
  platformAccessory: TestPlatformAccessory as unknown as API['platformAccessory'],
  on: jest.fn(),
  registerPlatform: jest.fn(),
  registerPlatformAccessories: jest.fn(),
  updatePlatformAccessories: jest.fn(),
  unregisterPlatformAccessories: jest.fn(),
} as unknown as jest.Mocked<API>);

let installationCounter = 0;

/** Each call gets its own giid by default, so tests sharing one `platform`
 * (and therefore its per-giid OverviewPoller cache) don't leak an earlier
 * test's cached overview/client into a later one. Pass an explicit `giid` in
 * `overrides` for tests that specifically want to share a poller. */
export const makeInstallation = (client: jest.Mock, overrides: Partial<VerisureInstallation> = {}): VerisureInstallation => {
  installationCounter += 1;
  const giid = `installation-${installationCounter}`;
  return {
    giid,
    locale: 'sv_SE',
    config: { giid, alias: 'Kungsgatan', locale: 'sv_SE' },
    client,
    ...overrides,
  } as unknown as VerisureInstallation;
};

export const makeAccessory = (deviceLabel: string | undefined, displayName = 'Test accessory'): PlatformAccessory<AccessoryContext> => {
  const uuid = hap.uuid.generate(deviceLabel ?? displayName);
  const accessory = new TestPlatformAccessory<AccessoryContext>(displayName, uuid);
  accessory.context = { deviceType: 'alarm', deviceLabel, installationGiid: 'abc123' };
  return accessory as unknown as PlatformAccessory<AccessoryContext>;
};

export const makePlatform = (config: Partial<VerisurePlatformConfig> = {}): VerisurePlatform => new VerisurePlatform(
  makeLogger(),
  { platform: 'verisure', name: 'Verisure', ...config },
  makeApi()
);
