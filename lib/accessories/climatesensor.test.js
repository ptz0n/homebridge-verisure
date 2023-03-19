const hap = require('hap-nodejs');

const ClimateSensor = require('./climatesensor');

describe('ClimateSensor', () => {
  const homebridge = { hap };
  const logger = { info: jest.fn() };
  const config = {
    device: {
      area: 'Hallway',
      deviceLabel: 'asd123',
      gui: {
        label: 'SMOKE',
      },
    },
    humidityValue: 55,
    temperatureValue: 22,
  };
  const installation = {
    getOverview: null,
    locale: 'sv_SE',
    config: {
      alias: 'Home',
    },
  };

  const climateSensor = new ClimateSensor(homebridge, logger, config, installation);

  it('setup name and value', () => {
    expect(climateSensor.name).toBe('Rökdetektor (Hallway)');
  });

  it('gets current temperature', (done) => {
    expect.assertions(2);

    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        climates: [{
          device: {
            deviceLabel: 'asd123',
          },
          temperatureValue: 22.5,
        }],
      },
    });

    climateSensor.getCurrentPropertyValue('temperature', (error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(22.5);
      done();
    });
  });

  it('gets current relative humidity', (done) => {
    expect.assertions(2);

    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        climates: [{
          device: {
            deviceLabel: 'asd123',
          },
          humidityValue: 62,
        }],
      },
    });

    climateSensor.getCurrentPropertyValue('humidity', (error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(62);
      done();
    });
  });

  it('setup name for unknown device type', () => {
    config.device.gui.label = 'FOOBAR';
    config.device.area = 'Kitchen';
    const anotherClimateSensor = new ClimateSensor(homebridge, logger, config, installation);
    expect(anotherClimateSensor.name).toBe('FOOBAR (Kitchen)');
  });

  it('expose only accessory & temp service', () => {
    const tempConfig = {
      device: {
        deviceLabel: 'asd123',
        gui: {
          label: 'SMOKE',
        },
      },
      temperatureValue: 22.5,
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
