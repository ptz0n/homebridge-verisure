const VerisureAccessory = require('./verisure');

class Alarm extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { alarmCode } = this.platformConfig;
    this.alarmCode = alarmCode.toString();
    this.model = 'ALARM';
    this.name = VerisureAccessory.getUniqueAccessoryName(`Alarm (${this.installation.config.alias})`);

    const { SecuritySystemCurrentState } = this.homebridge.hap.Characteristic;
    this.armStateMap = {
      ARMED_AWAY: SecuritySystemCurrentState.AWAY_ARM,
      ARMED_HOME: SecuritySystemCurrentState.STAY_ARM,
      DISARMED: SecuritySystemCurrentState.DISARMED,
    };
  }

  resolveArmState(input) {
    let output;

    // Verisure to HAP
    if (typeof input === 'string') {
      output = this.armStateMap[input];
    }

    // HAP to Verisure
    if (typeof input === 'number') {
      output = Object.keys(this.armStateMap).find((key) => this.armStateMap[key] === input);
    }

    if (typeof output === 'undefined') {
      throw Error(`Cannot resolve arm state from unknown input: ${input}`);
    }

    return output;
  }

  getCurrentAlarmState(callback) {
    this.log('Getting current alarm state.', 'debug');

    this.installation.getOverview()
      .then((overview) => {
        callback(null, this.resolveArmState(overview.armState.statusType));
      })
      .catch(callback);
  }

  setTargetAlarmState(value, callback) {
    this.log(`Setting target alarm state to: ${value}`);

    const request = {
      method: 'PUT',
      url: '/armstate/code',
      data: {
        code: this.alarmCode,
        state: this.resolveArmState(value),
      },
    };
    this.installation.client(request)
      .then(({ armStateChangeTransactionId }) => this.resolveChangeResult(`/code/result/${armStateChangeTransactionId}`))
      .then(() => {
        callback(); // Successful action.

        setImmediate(() => {
          const { SecuritySystemCurrentState } = this.homebridge.hap.Characteristic;
          this.service.setCharacteristic(SecuritySystemCurrentState, value);
        });
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.SecuritySystem(this.name);

    const currentStateCharacteristic = this.service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getCurrentAlarmState.bind(this));

    const targetStateCharacteristic = this.service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('get', this.getCurrentAlarmState.bind(this))
      .on('set', this.setTargetAlarmState.bind(this));

    const { NIGHT_ARM } = Characteristic.SecuritySystemTargetState;
    const validValues = targetStateCharacteristic.props.validValues
      .filter((state) => state !== NIGHT_ARM);
    targetStateCharacteristic.setProps({ validValues });

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    this.pollCharacteristics.push(currentStateCharacteristic);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = Alarm;
