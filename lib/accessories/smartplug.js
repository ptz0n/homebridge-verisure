const VerisureAccessory = require('./verisure');
const { overviewOperation, smartPlugStateOperation } = require('../operations');

class SmartPlug extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.model = 'SMARTPLUG';
    const area = (this.config.device.area || '').trim();
    this.name = VerisureAccessory.getUniqueAccessoryName(
      area ? `SmartPlug - ${area}` : 'SmartPlug'
    );
    this.value = SmartPlug.resolveSwitchState(this.config.currentState);
  }

  static resolveSwitchState(input) {
    return input === 'ON';
  }

  async getSwitchState() {
    this.log('Getting current switch state.');

    const overview = await this.installation.client(overviewOperation);
    const smartplug = overview.installation.smartplugs.find(
      (sp) => sp.device.deviceLabel === this.serialNumber
    );

    this.value = SmartPlug.resolveSwitchState(smartplug.currentState);
    return this.value;
  }

  async setSwitchState(value) {
    this.log(`Setting switch state to: ${value}`);

    this.value = value;

    try {
      await this.installation.client(smartPlugStateOperation(this.serialNumber, value));
    } catch (error) {
      this.log(`Error setting switch state: ${error.errorMessage}`);
      throw new Error(error.errorMessage);
    }
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.Switch(this.name);
    this.service
      .getCharacteristic(Characteristic.On)
      .onGet(this.getSwitchState.bind(this))
      .onSet(this.setSwitchState.bind(this));

    this.service.updateCharacteristic(Characteristic.On, this.value);

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = SmartPlug;
