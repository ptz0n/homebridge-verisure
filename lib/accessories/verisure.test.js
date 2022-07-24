const hap = require('hap-nodejs');

const Verisure = require('./verisure');

describe('Verisure', () => {
  const homebridge = { hap };
  const config = { deviceLabel: 'ASD123' };
  const installation = {
    client: null,
    config: {
      alias: 'Home',
    },
  };

  const logger = { info: jest.fn() };
  const verisure = new Verisure(homebridge, logger, config, installation);

  beforeEach(() => {
    logger.info.mockClear();
  });

  it('get lock state change result', () => {
    expect.assertions(5);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ functionType: 'CHANGE_ARMSTATE' });
    installation.client.mockResolvedValueOnce({ result: 'NO_DATA' });
    installation.client.mockResolvedValueOnce({ result: 'OK' });

    const resultUrl = '/some/path/123';
    return verisure.resolveChangeResult(resultUrl).then((result) => {
      expect(result).toBe('OK');
      const { calls } = installation.client.mock;
      expect(calls[0][0].url).toBe(resultUrl);
      expect(calls[1][0].url).toBe(resultUrl);
      expect(calls[2][0].url).toBe(resultUrl);
      expect(calls.length).toBe(3);
    });
  });

  it('prefixes logs with installation and accessory name', () => {
    verisure.name = 'SmartPlug (Hallway)';
    verisure.log('Something happened.');
    expect(logger.info.mock.calls[0][0]).toBe('Home SmartPlug (Hallway): Something happened.');
  });
});
