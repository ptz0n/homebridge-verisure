const hap = require('hap-nodejs');

const SmartPlug = require('./smartplug');

describe('SmartPlug', () => {
  const homebridge = { hap };
  const logger = { info: jest.fn() };
  const config = {
    device: {
      deviceLabel: 'ASD 123',
      area: 'Living room',
    },
    currentState: 'ON',
  };
  const installation = {
    client: null,
    config: {
      alias: 'Home',
    },
  };

  const smartPlug = new SmartPlug(homebridge, logger, config, installation);

  it('setup name and value', () => {
    expect(smartPlug.name).toBe('SmartPlug - Living room');
    expect(smartPlug.value).toBe(true);
  });

  it('get current switch state', (done) => {
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        smartplugs: [{
          device: {
            deviceLabel: 'ASD 123',
          },
          currentState: 'OFF',
        }],
      },
    });
    smartPlug.getSwitchState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(false);
      done();
    });
  });

  it('set switch state', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    // TODO: Confirm response.
    installation.client.mockResolvedValueOnce({ success: true });

    smartPlug.setSwitchState(true, (error) => {
      expect(smartPlug.value).toBe(true);
      expect(error).toBeNull();
      done();
    });
  });
});
