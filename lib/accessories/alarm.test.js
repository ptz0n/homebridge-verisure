const hap = require('@homebridge/hap-nodejs');

const Alarm = require('./alarm');

describe('Alarm', () => {
  const homebridge = { hap };
  const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  const config = {
    statusType: 'DISARMED',
  };
  const installation = {
    config: { alias: 'Kungsgatan' },
    client: null,
  };
  const platformConfig = {
    alarmCode: '000000',
  };
  const { SecuritySystemCurrentState } = hap.Characteristic;
  const alarm = new Alarm(
    homebridge,
    logger,
    config,
    installation,
    platformConfig
  );

  alarm.getServices();

  it('setup name', () => {
    expect(alarm.name).toBe('Alarm - Kungsgatan');
  });

  it('resolves arm states', () => {
    expect(alarm.resolveArmState('ARMED_AWAY')).toBe(
      SecuritySystemCurrentState.AWAY_ARM
    );
    expect(alarm.resolveArmState('ARMED_HOME')).toBe(
      SecuritySystemCurrentState.STAY_ARM
    );
    expect(alarm.resolveArmState('DISARMED')).toBe(
      SecuritySystemCurrentState.DISARMED
    );

    expect(alarm.resolveArmState(SecuritySystemCurrentState.AWAY_ARM)).toBe(
      'ARMED_AWAY'
    );
    expect(alarm.resolveArmState(SecuritySystemCurrentState.STAY_ARM)).toBe(
      'ARMED_HOME'
    );
    expect(alarm.resolveArmState(SecuritySystemCurrentState.DISARMED)).toBe(
      'DISARMED'
    );

    expect(() => alarm.resolveArmState('FOOBAR')).toThrow();
  });

  it('requests current arm state', async () => {
    expect.assertions(1);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        armState: {
          statusType: 'ARMED_AWAY',
        },
      },
    });
    const value = await alarm.getCurrentAlarmState();
    expect(value).toBe(SecuritySystemCurrentState.AWAY_ARM);
  });

  it('sets target arm state', async () => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      transactionId: 'asd123',
    });
    installation.client.mockResolvedValueOnce({
      installation: {
        pollResult: {
          result: 'OK',
        },
      },
    });

    await alarm.setTargetAlarmState(SecuritySystemCurrentState.AWAY_ARM);

    const { calls } = installation.client.mock;
    expect(calls.length).toBe(2);

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    expect(
      alarm.service.getCharacteristic(SecuritySystemCurrentState).value
    ).toBe(SecuritySystemCurrentState.AWAY_ARM);
  });

  it('retries once when arm state change is rejected', async () => {
    jest.useFakeTimers();
    installation.client = jest.fn();

    const error = new Error('GraphQL response contains 1 errors');
    error.name = 'GraphqlException';
    error.errors = [{ message: 'System busy' }];

    installation.client.mockRejectedValueOnce(error);
    installation.client.mockResolvedValueOnce({
      transactionId: 'asd123',
    });
    installation.client.mockResolvedValueOnce({
      installation: {
        pollResult: {
          result: 'OK',
        },
      },
    });

    const promise = alarm.setTargetAlarmState(
      SecuritySystemCurrentState.STAY_ARM
    );
    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(installation.client.mock.calls.length).toBe(3);
    expect(logger.warn).toHaveBeenCalledWith(
      'Kungsgatan Alarm - Kungsgatan: Arm state change to ARMED_HOME failed: [{"message":"System busy"}]. Retrying once.'
    );

    jest.useRealTimers();
  });

  it('includes error details when the retry is rejected', async () => {
    jest.useFakeTimers();
    installation.client = jest.fn();

    const makeError = () => {
      const error = new Error('GraphQL response contains 1 errors');
      error.name = 'GraphqlException';
      error.errors = [{ message: 'System busy' }];
      return error;
    };

    installation.client.mockRejectedValueOnce(makeError());
    installation.client.mockRejectedValueOnce(makeError());

    const promise = alarm.setTargetAlarmState(
      SecuritySystemCurrentState.DISARMED
    );
    promise.catch(() => {});
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).rejects.toThrow(
      'GraphQL response contains 1 errors: [{"message":"System busy"}]'
    );
    expect(installation.client.mock.calls.length).toBe(2);

    jest.useRealTimers();
  });

  it('does not retry other errors', async () => {
    installation.client = jest.fn();
    installation.client.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(
      alarm.setTargetAlarmState(SecuritySystemCurrentState.DISARMED)
    ).rejects.toThrow('socket hang up');
    expect(installation.client.mock.calls.length).toBe(1);
  });
});
