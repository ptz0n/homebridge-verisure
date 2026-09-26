import * as hap from '@homebridge/hap-nodejs';
import type { API, Logger } from 'homebridge';

import { makeApi, makeLogger } from './test/helpers';
import { VerisurePlatform } from './platform';
import type { VerisurePlatformConfig } from './types';

// discoverDevices() is private; it's the platform's actual entry point
// (normally invoked on the 'didFinishLaunching' event), so tests call it
// directly rather than reaching for internals.
interface TestablePlatform {
  config: VerisurePlatform['config'];
  configureAccessory: VerisurePlatform['configureAccessory'];
  discoverDevices(): Promise<void>;
}

const installationFixture = {
  giid: 'abc123',
  locale: 'sv_SE',
  config: { giid: 'abc123', alias: 'Home', locale: 'sv_SE' },
};

describe('VerisurePlatform', () => {
  let api: jest.Mocked<API>;
  let log: jest.Mocked<Logger>;

  beforeEach(() => {
    api = makeApi();
    log = makeLogger();
  });

  afterEach(() => {
    // Every discoverDevices() call starts a real setInterval poller; invoke
    // the platform's own 'shutdown' handler (as Homebridge would) so it
    // doesn't leak a timer past the end of the test.
    const shutdown = api.on.mock.calls.find(([event]) => event === 'shutdown')?.[1];
    shutdown?.();
  });

  const makePlatformWithVerisure = (config: Partial<VerisurePlatformConfig>, verisureMocks: {
    cookies?: string[];
    getToken?: jest.Mock;
    getCookie?: jest.Mock;
    getInstallations?: jest.Mock;
  }) => {
    const platform = new VerisurePlatform(log, { platform: 'verisure', name: 'Verisure', ...config }, api);
    const verisure = (platform as unknown as { verisure: Record<string, unknown> }).verisure;
    verisure.cookies = verisureMocks.cookies ?? ['vid=x', 'vs-access=y', 'vs-refresh=z'];
    verisure.getToken = verisureMocks.getToken ?? jest.fn();
    verisure.getCookie = verisureMocks.getCookie ?? jest.fn().mockReturnValue('vid=x');
    verisure.getInstallations = verisureMocks.getInstallations ?? jest.fn().mockResolvedValue([]);
    return platform as unknown as TestablePlatform;
  };

  const withOverviewClient = (overview: Record<string, unknown>) => {
    const client = jest.fn().mockResolvedValue({ installation: overview });
    return { ...installationFixture, client };
  };

  it('reads environment variable overrides for credentials and codes', () => {
    process.env.VERISURE_EMAIL = 'env@example.com';
    process.env.VERISURE_ALARM_CODE = '9999';
    const platform = new VerisurePlatform(log, { platform: 'verisure', name: 'Verisure', email: 'config@example.com' }, api);
    expect(platform.config.email).toBe('env@example.com');
    expect(platform.config.alarmCode).toBe('9999');
    delete process.env.VERISURE_EMAIL;
    delete process.env.VERISURE_ALARM_CODE;
  });

  it('logs an actionable error and does not throw when MFA is required but no cookies were configured', async () => {
    const platform = makePlatformWithVerisure({}, {
      cookies: [],
      getToken: jest.fn().mockResolvedValue([]),
      getCookie: jest.fn().mockReturnValue(undefined),
    });

    await expect(platform.discoverDevices()).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('MFA'));
    expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
  });

  it('logs an actionable error when the configured email/password is rejected', async () => {
    const unauthorized = Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } });
    const platform = makePlatformWithVerisure({}, {
      cookies: [],
      getToken: jest.fn().mockRejectedValue(unauthorized),
    });

    await expect(platform.discoverDevices()).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('credentials'));
    expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
  });

  it('registers alarm, climate, contact, plug and lock accessories discovered from the overview', async () => {
    const installation = withOverviewClient({
      armState: { statusType: 'DISARMED' },
      climates: [{ device: { deviceLabel: 'c1', area: 'Hall', gui: { label: 'SMOKE' } }, temperatureValue: 20 }],
      doorWindows: [{ device: { deviceLabel: 'd1', area: 'Front door' }, state: 'CLOSE' }],
      smartplugs: [{ device: { deviceLabel: 'p1', area: 'Kitchen' }, currentState: 'ON' }],
      doorlocks: [{ device: { deviceLabel: 'l1', area: 'Entré' }, currentLockState: 'LOCKED' }],
    });
    const platform = makePlatformWithVerisure(
      { alarmCode: '0000', doorCode: '000000' },
      { getInstallations: jest.fn().mockResolvedValue([installation]) }
    );

    await platform.discoverDevices();

    const [, , registered] = api.registerPlatformAccessories.mock.calls[0];
    expect(registered).toHaveLength(5);
  });

  it('does not register the alarm without an alarmCode, or the lock without a doorCode', async () => {
    const installation = withOverviewClient({
      armState: { statusType: 'DISARMED' },
      doorlocks: [{ device: { deviceLabel: 'l1', area: 'Entré' }, currentLockState: 'LOCKED' }],
    });
    const platform = makePlatformWithVerisure({}, { getInstallations: jest.fn().mockResolvedValue([installation]) });

    await platform.discoverDevices();

    expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
  });

  it('excludes accessory types and specific devices per config', async () => {
    const installation = withOverviewClient({
      climates: [{ device: { deviceLabel: 'c1', area: 'Hall', gui: { label: 'SMOKE' } }, temperatureValue: 20 }],
      doorWindows: [
        { device: { deviceLabel: 'd1', area: 'Front door' }, state: 'CLOSE' },
        { device: { deviceLabel: 'd2', area: 'Back door' }, state: 'CLOSE' },
      ],
    });
    const platform = makePlatformWithVerisure(
      { excludedAccessoryTypes: ['climateSensor'], excludedDevices: ['Back door'] },
      { getInstallations: jest.fn().mockResolvedValue([installation]) }
    );

    await platform.discoverDevices();

    const [, , registered] = api.registerPlatformAccessories.mock.calls[0];
    expect(registered).toHaveLength(1);
    expect(registered[0].displayName).toBe('Front door');
  });

  it('keeps a previously cached accessory registered when the startup fetch fails - regression test for #137', async () => {
    // Homebridge restores accessories from its on-disk cache and calls
    // configureAccessory() for each one *before* discoverDevices() ever
    // runs. If that first fetch then fails (e.g. a transient internet
    // outage right as Homebridge restarts), the accessory must be left
    // alone rather than unregistered.
    const failingClient = jest.fn().mockRejectedValue(new Error('network down'));
    const installation = { ...installationFixture, client: failingClient };
    const platform = makePlatformWithVerisure({}, { getInstallations: jest.fn().mockResolvedValue([installation]) });

    const uuid = hap.uuid.generate('homebridge-verisure:abc123:smartPlug:p1');
    const cached = new (api.platformAccessory as unknown as new (n: string, u: string) => { UUID: string; context: unknown })('SmartPlug - Kitchen', uuid);
    cached.context = { deviceType: 'smartPlug', deviceLabel: 'p1', installationGiid: 'abc123' };
    platform.configureAccessory(cached as never);

    await platform.discoverDevices();

    expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
    expect(api.unregisterPlatformAccessories).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('network down'));
  });

  it('removes an accessory that has genuinely disappeared from a successful fetch', async () => {
    const overview = {
      smartplugs: [{ device: { deviceLabel: 'p1', area: 'Kitchen' }, currentState: 'ON' }],
    };
    const client = jest.fn().mockResolvedValue({ installation: overview });
    const installation = { ...installationFixture, client };
    const platform = makePlatformWithVerisure({}, { getInstallations: jest.fn().mockResolvedValue([installation]) });

    await platform.discoverDevices();
    expect(api.registerPlatformAccessories).toHaveBeenCalledTimes(1);

    overview.smartplugs = [];
    await platform.discoverDevices();

    expect(api.unregisterPlatformAccessories).toHaveBeenCalledTimes(1);
  });

  it('restores a cached accessory instead of creating a duplicate', async () => {
    const overview = {
      smartplugs: [{ device: { deviceLabel: 'p1', area: 'Kitchen' }, currentState: 'ON' }],
    };
    const client = jest.fn().mockResolvedValue({ installation: overview });
    const installation = { ...installationFixture, client };
    const platform = makePlatformWithVerisure({}, { getInstallations: jest.fn().mockResolvedValue([installation]) });

    const uuid = hap.uuid.generate('homebridge-verisure:abc123:smartPlug:p1');
    const cached = new (api.platformAccessory as unknown as new (n: string, u: string) => { UUID: string; context: unknown })('SmartPlug - Kitchen', uuid);
    cached.context = { deviceType: 'smartPlug', deviceLabel: 'p1', installationGiid: 'abc123' };
    platform.configureAccessory(cached as never);

    await platform.discoverDevices();

    expect(api.registerPlatformAccessories).not.toHaveBeenCalled();
  });
});
