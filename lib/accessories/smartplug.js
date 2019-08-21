const VerisureAccessory = require('./verisure');

class SmartPlug extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.model = 'SMARTPLUG';
    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartPlug (${this.config.area})`);
    this.value = SmartPlug.resolveSwitchState(this.config.currentState);
  }

  static resolveSwitchState(input) {
    return input === 'ON';
  }

  getSwitchState(callback) {
    this.log('Getting current switch state.');

    this.installation.getOverview()
      .then((overview) => overview.smartPlugs
        .find((smartPlug) => smartPlug.deviceLabel === this.serialNumber))
      .then((smartPlug) => {
        this.value = SmartPlug.resolveSwitchState(smartPlug.currentState);
        callback(null, this.value);
      })
      .catch(callback);
  }

  setSwitchState(value, callback) {
    this.log(`Setting switch state to: ${value}`);

    this.value = value;

    const request = {
      method: 'POST',
      uri: '/smartplug/state',
      json: [{
        deviceLabel: this.serialNumber,
        state: value,
      }],
    };

    this.installation.client(request)
      .then(() => callback(null))
      .catch((error) => {
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
