const VerisurePlatform = require('./platform');

describe('Platform', () => {
  it('throws if constructed without first initiate module', () => {
    expect(typeof VerisurePlatform.init).toBe('function');
    expect(() => {
      // eslint-disable-next-line no-new
      new VerisurePlatform();
    }).toThrowError('Module not initiated.');
  });

  it('module exposes a platform class', () => {
    VerisurePlatform.init('homebridge');
    const platform = new VerisurePlatform('log', 'config');
    expect(platform).toBeInstanceOf(VerisurePlatform);
    expect(platform.config).toBe('config');
    expect(platform.log).toBe('log');
  });

  it('transform empty overview into empty lists of device configs', () => {
    const deviceConfigs = {
      alarm: [],
      climateSensor: [],
      doorLock: [],
      smartPlug: [],
    };
    expect(VerisurePlatform.overviewToDeviceConfigs({})).toMatchObject(deviceConfigs);
  });

  it('transform overview into device configs', () => {
    const overview = {
      climateValues: [{ deviceLabel: 'ABCD 1234' }],
      doorWindow: {
        doorWindowDevice: [{ deviceLabel: 'DEFG 2345' }],
      },
      smartPlugs: [{ deviceLabel: 'EFGH 3456' }],
    };
    expect(VerisurePlatform.overviewToDeviceConfigs(overview)).toMatchObject({
      alarm: [],
      climateSensor: [{ deviceLabel: 'ABCD 1234' }],
      doorLock: [],
      smartPlug: [{ deviceLabel: 'EFGH 3456' }],
    });
  });
});
