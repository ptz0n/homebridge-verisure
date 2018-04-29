const hap = require('hap-nodejs');

const Alarm = require('./alarm');

describe('Alarm', () => {
  const homebridge = { hap };
  const config = {
    statusType: 'DISARMED',
  };
  const installation = {
    config: { alias: 'Kungsgatan' },
    getOverview: null,
  };
  const { SecuritySystemCurrentState } = hap.Characteristic;
  const alarm = new Alarm(homebridge, null, config, installation);

  it('setup name and value', () => {
    expect(alarm.name).toBe('Alarm (Kungsgatan)');
    expect(alarm.value).toBe(SecuritySystemCurrentState.DISARMED);
  });

  it('resolves arm states', () => {
    expect(alarm.resolveArmState('DISARMED')).toBe(SecuritySystemCurrentState.DISARMED);
    expect(alarm.resolveArmState('ARMED_AWAY')).toBe(SecuritySystemCurrentState.AWAY_ARM);
    expect(alarm.resolveArmState('ARMED_HOME')).toBe(SecuritySystemCurrentState.STAY_ARM);
    expect(() => alarm.resolveArmState('FOOBAR')).toThrow();
  });

  it('requests current arm state', (done) => {
    installation.getOverview = jest.fn();
    installation.getOverview.mockResolvedValueOnce({
      armState: {
        statusType: 'ARMED_AWAY',
      },
    });
    alarm.getCurrentAlarmState((error, value) => {
      expect(error).toBe(null);
      expect(value).toBe(SecuritySystemCurrentState.AWAY_ARM);
      done();
    });
  });
});
