const VerisureAccessory = require('./verisure');

class ContactSensor extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { area, state } = this.config;

    this.name = VerisureAccessory.getUniqueAccessoryName(area);
    this.value = ContactSensor.resolveSensorState(state);
  }

  static resolveSensorState(input) {
    return input !== 'CLOSE';
  }

  getCurrentSensorState(callback) {
    this.log('Getting current sensor state.');

    this.installation.getOverview()
      .then((overview) => overview.doorWindow.doorWindowDevice
        .find((device) => device.deviceLabel === this.serialNumber))
      .then((device) => {
        this.value = ContactSensor.resolveSensorState(device.state);
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
