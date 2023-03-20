const VerisureAccessory = require('./verisure');
const { overviewOperation } = require('../operations');

class ContactSensor extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { device: { area }, state } = this.config;

    this.name = VerisureAccessory.getUniqueAccessoryName(area);
    this.value = ContactSensor.resolveSensorState(state);
  }

  static resolveSensorState(input) {
    return input !== 'CLOSE';
  }

  getCurrentSensorState(callback) {
    this.log('Getting current sensor state.', 'debug');

    this.installation.client(overviewOperation)
      .then((overview) => overview.installation.doorWindows
        .find((doorWindow) => doorWindow.device.deviceLabel === this.serialNumber))
      .then((doorWindow) => {
        this.value = ContactSensor.resolveSensorState(doorWindow.state);
        callback(null, this.value);
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.ContactSensor(this.name);
    const currentStateCharacteristic = this.service
      .getCharacteristic(Characteristic.ContactSensorState)
      .on('get', this.getCurrentSensorState.bind(this));

    this.pollCharacteristics.push(currentStateCharacteristic);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = ContactSensor;
