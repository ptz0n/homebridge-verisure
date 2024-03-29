const VerisurePlatform = require('./platform');

describe('Platform', () => {
  it('throws if constructed without first initiate module', () => {
    expect(typeof VerisurePlatform.init).toBe('function');
    expect(() => {
      // eslint-disable-next-line no-new
      new VerisurePlatform();
    }).toThrowError('Module not initiated.');
  });

  it('module exposes a platform class with default values', () => {
    VerisurePlatform.init('homebridge');
    const platform = new VerisurePlatform('logger', {});
    expect(platform).toBeInstanceOf(VerisurePlatform);
    expect(platform.config).toMatchObject({
      pollInterval: 60,
      showAutoLockSwitch: true,
      showAudioSwitch: true,
      audioOffValue: 'LOW',
      audioOnValue: 'HIGH',
    });
    expect(platform.logger).toBe('logger');
  });

  it('platform builds config with defaults', () => {
    const platform = new VerisurePlatform(null, {
      alarmCode: '2345',
      doorcode: '1234', // deprecated door code config key
    });
    expect(platform.config).toMatchObject({
      alarmCode: '2345',
      doorCode: '1234', // resolves to camel case 👍
      installations: [],
      pollInterval: 60,
    });
  });

  it('platform builds config with passed values', () => {
    const config = {
      alarmCode: '2345',
      doorCode: '1234',
      email: 'foo@bar.com',
      password: 't0ps3cret',
      installations: ['Alias'],
      pollInterval: 120,
    };
    const platform = new VerisurePlatform(null, config);
    expect(platform.config).toMatchObject(config);
  });

  it('platform builds config with environment variables', () => {
    const envVars = {
      VERISURE_ALARM_CODE: '2345',
      VERISURE_DOOR_CODE: '1234',
      VERISURE_EMAIL: 'foo@bar.com',
      VERISURE_COOKIES: 'foo=bar;asd=123',
      VERISURE_PASSWORD: 't0ps3cret',
    };

    const envKeys = Object.keys(envVars);

    envKeys.forEach((key) => { process.env[key] = envVars[key]; });

    const config = {
      alarmCode: envVars.VERISURE_ALARM_CODE,
      doorCode: envVars.VERISURE_DOOR_CODE,
      email: envVars.VERISURE_EMAIL,
      cookies: ['foo=bar', 'asd=123'],
      password: envVars.VERISURE_PASSWORD,
    };

    const platform = new VerisurePlatform(null, {});
    expect(platform.config).toMatchObject(config);

    envKeys.forEach((key) => { process.env[key] = null; });
  });

  it('transform empty overview into empty lists of device configs', () => {
    const deviceConfigs = {
      alarm: [],
      climateSensor: [],
      contactSensor: [],
      doorLock: [],
      smartPlug: [],
    };
    expect(VerisurePlatform.overviewToDeviceConfigs({})).toMatchObject(deviceConfigs);
  });

  it('transform overview into device configs', () => {
    const overview = {
      armState: { statusType: 'DISARMED' },
      climates: [{ device: { deviceLabel: 'ABCD 1234' } }],
      doorWindows: [{ device: { deviceLabel: 'DEFG 2345' } }],
      doorlocks: [],
      smartplugs: [{ device: { deviceLabel: 'EFGH 3456' } }],
    };
    expect(VerisurePlatform.overviewToDeviceConfigs(overview)).toMatchObject({
      alarm: [{ statusType: 'DISARMED' }],
      climateSensor: [{ device: { deviceLabel: 'ABCD 1234' } }],
      contactSensor: [{ device: { deviceLabel: 'DEFG 2345' } }],
      doorLock: [],
      smartPlug: [{ device: { deviceLabel: 'EFGH 3456' } }],
    });
  });
});
