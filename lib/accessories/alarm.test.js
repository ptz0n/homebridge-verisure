const hap = require('hap-nodejs');

const Alarm = require('./alarm');

describe('Alarm', () => {
  const homebridge = { hap };
  const logger = jest.fn();
  const config = {
    statusType: 'DISARMED',
  };
  const installation = {
    config: { alias: 'Kungsgatan' },
    getOverview: null,
  };
  const platformConfig = {
    alarmCode: '000000',
  };
  const { SecuritySystemCurrentState } = hap.Characteristic;
  const alarm = new Alarm(homebridge, logger, config, installation, platformConfig);

  alarm.getServices();

  it('setup name', () => {
    expect(alarm.name).toBe('Alarm (Kungsgatan)');
  });

  it('resolves arm states', () => {
    expect(alarm.resolveArmState('ARMED_AWAY')).toBe(SecuritySystemCurrentState.AWAY_ARM);
    expect(alarm.resolveArmState('ARMED_HOME')).toBe(SecuritySystemCurrentState.STAY_ARM);
    expect(alarm.resolveArmState('DISARMED')).toBe(SecuritySystemCurrentState.DISARMED);

    expect(alarm.resolveArmState(SecuritySystemCurrentState.AWAY_ARM)).toBe('ARMED_AWAY');
    expect(alarm.resolveArmState(SecuritySystemCurrentState.STAY_ARM)).toBe('ARMED_HOME');
    expect(alarm.resolveArmState(SecuritySystemCurrentState.DISARMED)).toBe('DISARMED');

    expect(() => alarm.resolveArmState('FOOBAR')).toThrow();
  });

  it('requests current arm state', (done) => {
    expect.assertions(2);
    installation.getOverview = jest.fn();
    installation.getOverview.mockResolvedValueOnce({
      armState: {
        statusType: 'ARMED_AWAY',
      },
    });
    alarm.getCurrentAlarmState((error, value) => {
      expect(error).toBeFalsy();
      expect(value).toBe(SecuritySystemCurrentState.AWAY_ARM);
      done();
    });
  });

  it('sets target arm state', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      doorLockStateChangeTransactionId: 'asd123',
    });
    installation.client.mockResolvedValueOnce({
      result: 'OK',
    });

    alarm.setTargetAlarmState(SecuritySystemCurrentState.AWAY_ARM, (error) => {
      expect(error).toBeFalsy();

      setTimeout(() => { // Wait for setImmediate
        expect(alarm.service.getCharacteristic(SecuritySystemCurrentState).value)
          .toBe(SecuritySystemCurrentState.AWAY_ARM);
        done();
      }, 100);
    });
  });
});
