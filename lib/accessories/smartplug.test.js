const hap = require('@homebridge/hap-nodejs');

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

  it('get current switch state', async () => {
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
    const value = await smartPlug.getSwitchState();
    expect(value).toBe(false);
  });

  it('set switch state', async () => {
    expect.assertions(1);
    installation.client = jest.fn();
    // TODO: Confirm response.
    installation.client.mockResolvedValueOnce({ success: true });

    await smartPlug.setSwitchState(true);
    expect(smartPlug.value).toBe(true);
  });
});
