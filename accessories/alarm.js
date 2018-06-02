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
      ARMED_AWAY: [SecuritySystemCurrentState.AWAY_ARM],
      ARMED_HOME: [
        SecuritySystemCurrentState.STAY_ARM,
        SecuritySystemCurrentState.NIGHT_ARM,
      ],
      DISARMED: [SecuritySystemCurrentState.DISARMED],
    };

    this.value = this.resolveArmState(this.config.statusType);

    // TODO: Init polling for externally invoked state changes.
  }

  resolveArmState(input) {
    let output;

    // Verisure to HAP
    if (typeof input === 'string') {
      [output] = this.armStateMap[input];
    }

    // HAP to Verisure
    if (typeof input === 'number') {
      output = Object.keys(this.armStateMap).find(key => this.armStateMap[key].includes(input));
    }

    if (typeof output === 'undefined') {
      throw Error(`Cannot resolve arm state from unknown input: ${input}`);
    }

    return output;
  }

  getCurrentAlarmState(callback) {
    this.log('Getting current alarm state.');

    this.installation.getOverview()
      .then((overview) => {
        this.value = this.resolveArmState(overview.armState.statusType);
        callback(null, this.value);
      })
      .catch((error) => {
        callback(error);
      });
  }

  setTargetAlarmState(value, callback) {
    this.log(`Setting target alarm state to: ${value}`);

    const request = {
      method: 'PUT',
      uri: '/armstate/code',
      json: {
        code: this.alarmCode,
        state: this.resolveArmState(value),
      },
    };
    this.installation.client(request)
      .then(({ armStateChangeTransactionId }) =>
        this.resolveChangeResult(`/code/result/${armStateChangeTransactionId}`))
      .then(() => {
        const { SecuritySystemCurrentState } = this.homebridge.hap.Characteristic;
        this.service.updateCharacteristic(SecuritySystemCurrentState, value);
        this.value = value;
        callback(null, value);
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.SecuritySystem(this.name);
    this.service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getCurrentAlarmState.bind(this));

    this.service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('get', this.getCurrentAlarmState.bind(this))
      .on('set', this.setTargetAlarmState.bind(this));

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = Alarm;
