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
  };
  const installation = {
    getOverview: null,
    locale: 'sv_SE',
  };

  const climateSensor = new ClimateSensor(homebridge, logger, config, installation);

  it('setup name and value', () => {
    expect(climateSensor.name).toBe('Rökdetektor (Hallway)');
    expect(climateSensor.value).toBe(22);
  });

  it('gets current temperature', (done) => {
    expect.assertions(3);

    installation.getOverview = jest.fn();
    installation.getOverview.mockResolvedValueOnce({
      climateValues: [{
        temperature: 22.5,
        deviceLabel: 'asd123',
      }],
    });

    climateSensor.getCurrentTemperature((error, value) => {
      expect(error).toBe(null);
      expect(value).toBe(22.5);
      expect(climateSensor.value).toBe(22.5);
      done();
    });
  });

  it('setup name for unknown device type', () => {
    config.deviceType = 'FOOBAR';
    config.deviceArea = 'Kitchen';
    const anotherClimateSensor = new ClimateSensor(homebridge, logger, config, installation);
    expect(anotherClimateSensor.name).toBe('FOOBAR (Kitchen)');
  });
});
