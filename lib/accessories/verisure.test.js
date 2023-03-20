const hap = require('hap-nodejs');

const Verisure = require('./verisure');

describe('Verisure', () => {
  const homebridge = { hap };
  const config = {
    device: {
      deviceLabel: 'ASD123',
    },
  };
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
    expect.assertions(4);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ installation: { pollResult: { result: null } } });
    installation.client.mockResolvedValueOnce({ installation: { pollResult: { result: 'OK' } } });

    const operation = {
      operationName: 'pollArmState',
      variables: {
        transactionId: '1234',
        futureState: 'SOME_STATE',
      },
    };

    return verisure.resolveChangeResult(operation).then((result) => {
      expect(result).toBe('OK');
      const { calls } = installation.client.mock;
      expect(calls[0][0].variables).toMatchObject(operation.variables);
      expect(calls[1][0].variables).toMatchObject(operation.variables);
      expect(calls.length).toBe(2);
    });
  });

  it('prefixes logs with installation and accessory name', () => {
    verisure.name = 'SmartPlug (Hallway)';
    verisure.log('Something happened.');
    expect(logger.info.mock.calls[0][0]).toBe('Home SmartPlug (Hallway): Something happened.');
  });
});
