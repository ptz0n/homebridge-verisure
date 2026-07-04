const VerisureAccessory = require('./verisure');
const { overviewOperation } = require('../operations');

class ContactSensor extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const {
      device: { area },
      state,
    } = this.config;

    this.name = VerisureAccessory.getUniqueAccessoryName((area || '').trim() || 'Contact sensor');
    this.value = ContactSensor.resolveSensorState(state);
  }

  static resolveSensorState(input) {
    return input !== 'CLOSE';
  }

  async getCurrentSensorState() {
    this.log('Getting current sensor state.', 'debug');

    const overview = await this.installation.client(overviewOperation);
    const doorWindow = overview.installation.doorWindows.find(
      (dw) => dw.device.deviceLabel === this.serialNumber
    );

    this.value = ContactSensor.resolveSensorState(doorWindow.state);
    return this.value;
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.ContactSensor(this.name);
    const currentStateCharacteristic = this.service
      .getCharacteristic(Characteristic.ContactSensorState)
      .onGet(this.getCurrentSensorState.bind(this));

    this.pollCharacteristics.push({
      characteristic: currentStateCharacteristic,
      getter: this.getCurrentSensorState.bind(this),
    });

    return [this.accessoryInformation, this.service];
  }
}

module.exports = ContactSensor;
