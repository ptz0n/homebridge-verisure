const hap = require('hap-nodejs');

const ClimateSensor = require('./climatesensor');

describe('ClimateSensor', () => {
  it('setup name and value', () => {
    const homebridge = { hap };
    const config = {
      deviceArea: 'Hallway',
      deviceType: 'SMOKE2',
      temperature: 22,
    };
    const installation = {
      locale: 'sv_SE',
    };

    const climateSensor = new ClimateSensor(homebridge, null, config, installation);
    expect(climateSensor.name).toBe('Rökdetektor (Hallway)');
    expect(climateSensor.value).toBe(22);
  });
});
