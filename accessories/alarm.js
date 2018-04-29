const VerisureAccessory = require('./verisure');

class Alarm extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.model = 'ALARM';
    this.name = VerisureAccessory.getUniqueAccessoryName(`Alarm (${this.installation.config.alias})`);

    this.value = this.resolveArmState(this.config.statusType);
  }

  resolveArmState(statusType) {
    const { SecuritySystemCurrentState } = this.homebridge.hap.Characteristic;

    switch (statusType) {
      case 'ARMED_AWAY':
        return SecuritySystemCurrentState.AWAY_ARM;
      case 'ARMED_HOME':
        return SecuritySystemCurrentState.STAY_ARM;
      case 'DISARMED':
        return SecuritySystemCurrentState.DISARMED;
      default:
        throw Error(`Cannot resolve arm state from unknown statusType "${statusType}".`);
    }
  }

  getCurrentAlarmState(callback) {
    this.installation.getOverview()
      .then((overview) => {
        this.value = this.resolveArmState(overview.armState.statusType);
        callback(null, this.value);
      })
      .catch((error) => {
        callback(error);
      });
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.SecuritySystem(this.name);
    this.service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .on('get', this.getCurrentAlarmState.bind(this));

    // this.service
    //   .getCharacteristic(Characteristic.SecuritySystemTargetState)
    //   .on('get', this.getCurrentAlarmState.bind(this))
    //   .on('set', this.setTargetAlarmState.bind(this));

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = Alarm;
