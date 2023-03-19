const hap = require('hap-nodejs');

const ContactSensor = require('./contactsensor');

describe('ContactSensor', () => {
  const homebridge = { hap };
  const logger = { info: jest.fn(), debug: jest.fn() };
  const config = {
    device: {
      area: 'Front door',
      deviceLabel: 'DEFG 4567',
    },
    state: 'CLOSE',
  };
  const installation = {
    client: null,
    config: {
      alias: 'Home',
    },
  };

  const contactSensor = new ContactSensor(homebridge, logger, config, installation);

  it('setup name and value', () => {
    expect(contactSensor.name).toBe('Front door');
    expect(contactSensor.value).toBe(false);
  });

  it('resolves state', () => {
    expect(ContactSensor.resolveSensorState('OPEN')).toBe(true);
    expect(ContactSensor.resolveSensorState('CLOSE')).toBe(false);
    expect(ContactSensor.resolveSensorState('ASD')).toBe(true);
  });

  it('gets current state', (done) => {
    expect.assertions(3);

    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        doorWindows: [{
          device: {
            deviceLabel: 'DEFG 4567',
          },
          state: 'OPEN',
        }],
      },
    });

    contactSensor.getCurrentSensorState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(true);
      expect(contactSensor.value).toBe(true);
      done();
    });
  });

  it('exposes services', () => {
    const services = contactSensor.getServices();
    expect(services.length).toBe(2);
    expect(Array.isArray(services)).toBe(true);
  });
});
