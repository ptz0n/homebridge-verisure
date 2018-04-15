const VerisureAccessory = require('./verisure');

class SmartPlug extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.model = 'SMARTPLUG';
    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartPlug (${this.config.area})`);
    this.value = this.config.currentState === 'ON' ? 1 : 0;
  }

  getSwitchOn(callback) {
    this.log(`${this.name} (${this.serialNumber}): Getting current value...`);

    this.installation.getOverview()
      .then(overview =>
        overview.smartPlugs.find(smartPlug =>
          smartPlug.deviceLabel === this.serialNumber))
      .then((smartPlug) => {
        this.value = smartPlug.currentState === 'ON' ? 1 : 0;
        callback(null, this.value);
      })
      .catch(callback);
  }

  setSwitchOn(value, callback) {
    this.log(`${this.name} (${this.serialNumber}): Setting current value to "${value}"...`);
    this.value = value;

    const request = {
      method: 'POST',
      uri: '/smartplug/state',
      json: [{
        deviceLabel: this.serialNumber,
        state: value === 1,
      }],
    };

    this.installation.client(request)
      .then(() => callback(null))
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.Switch(this.name);
    this.service
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchOn.bind(this))
      .on('set', this.setSwitchOn.bind(this))
      .value = this.value;

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = SmartPlug;
