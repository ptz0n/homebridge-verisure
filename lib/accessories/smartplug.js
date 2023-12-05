const VerisureAccessory = require('./verisure');
const { overviewOperation, smartPlugStateOperation } = require('../operations');

class SmartPlug extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.model = 'SMARTPLUG';
    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartPlug - ${this.config.device.area}`);
    this.value = SmartPlug.resolveSwitchState(this.config.currentState);
  }

  static resolveSwitchState(input) {
    return input === 'ON';
  }

  getSwitchState(callback) {
    this.log('Getting current switch state.');

    this.installation.client(overviewOperation)
      .then((overview) => overview.installation.smartplugs
        .find((smartplug) => smartplug.device.deviceLabel === this.serialNumber))
      .then((smartplug) => {
        this.value = SmartPlug.resolveSwitchState(smartplug.currentState);
        callback(null, this.value);
      })
      .catch(callback);
  }

  setSwitchState(value, callback) {
    this.log(`Setting switch state to: ${value}`);

    this.value = value;

    this.installation.client(smartPlugStateOperation(this.serialNumber, value))
      // TODO: Poll for result?
      .then(() => callback(null))
      .catch((error) => {
        this.log(`Error setting switch state: ${error.errorMessage}`);
        callback({ message: error.errorMessage });
      });
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.Switch(this.name);
    this.service
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchState.bind(this))
      .on('set', this.setSwitchState.bind(this))
      .value = this.value;

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = SmartPlug;
