const hap = require('hap-nodejs');

const ClimateSensor = require('./climatesensor');

describe('ClimateSensor', () => {
  const homebridge = { hap };
  const logger = jest.fn();
  const config = {
    deviceArea: 'Hallway',
    deviceLabel: 'asd123',
    deviceType: 'SMOKE2',
    temperature: 22,
    humidity: 55,
  };
  const installation = {
    getOverview: null,
    locale: 'sv_SE',
  };

  const climateSensor = new ClimateSensor(homebridge, logger, config, installation);

  it('setup name and value', () => {
    expect(climateSensor.name).toBe('Rökdetektor (Hallway)');
  });

  it('gets current temperature', (done) => {
    expect.assertions(2);

    installation.getOverview = jest.fn();
    installation.getOverview.mockResolvedValueOnce({
      climateValues: [{
        deviceLabel: 'asd123',
        temperature: 22.5,
      }],
    });

    climateSensor.getCurrentPropertyValue('temperature', (error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(22.5);
      done();
    });
  });

  it('gets current relative humidity', (done) => {
    expect.assertions(2);

    installation.getOverview = jest.fn();
    installation.getOverview.mockResolvedValueOnce({
      climateValues: [{
        deviceLabel: 'asd123',
        humidity: 62,
      }],
    });

    climateSensor.getCurrentPropertyValue('humidity', (error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(62);
      done();
    });
  });

  it('setup name for unknown device type', () => {
    config.deviceType = 'FOOBAR';
    config.deviceArea = 'Kitchen';
    const anotherClimateSensor = new ClimateSensor(homebridge, logger, config, installation);
    expect(anotherClimateSensor.name).toBe('FOOBAR (Kitchen)');
  });

  it('expose only accessory & temp service', () => {
    const tempConfig = {
      deviceLabel: 'asd234',
      temperature: 22,
    };
    const tempSensor = new ClimateSensor(homebridge, logger, tempConfig, installation);
    const services = tempSensor.getServices();
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBe(2);
  });

  it('expose all services', () => {
    const services = climateSensor.getServices();
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBe(3);
  });
});
