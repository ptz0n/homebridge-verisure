const hap = require('hap-nodejs');

const Verisure = require('./verisure');

describe('Verisure', () => {
  const homebridge = { hap };
  const config = { deviceLabel: 'ASD123' };
  const installation = { client: null };

  const verisure = new Verisure(homebridge, jest.fn(), config, installation);

  it('get lock state change result', () => {
    expect.assertions(5);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ functionType: 'CHANGE_ARMSTATE' });
    installation.client.mockResolvedValueOnce({ result: 'NO_DATA' });
    installation.client.mockResolvedValueOnce({ result: 'OK' });

    const resultUri = '/some/path/123';
    return verisure.resolveChangeResult(resultUri).then((result) => {
      expect(result).toBe('OK');
      const { calls } = installation.client.mock;
      expect(calls[0][0].uri).toBe(resultUri);
      expect(calls[1][0].uri).toBe(resultUri);
      expect(calls[2][0].uri).toBe(resultUri);
      expect(calls.length).toBe(3);
    });
  });

  it('logs with accessory name prefix', () => {
    const logger = jest.fn();
    const verisureWithLogger = new Verisure(homebridge, logger, config, installation);

    verisureWithLogger.name = 'SmartPlug (Hallway)';
    verisureWithLogger.log('Something happened.');
    expect(logger.mock.calls[0][0]).toBe('info');
    expect(logger.mock.calls[0][1]).toBe('SmartPlug (Hallway): Something happened.');
  });
});
