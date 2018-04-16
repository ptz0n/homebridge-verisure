const VerisureAccessory = require('./verisure');

const deviceNames = {
  HUMIDITY1: 'Klimatdetektor',
  SIREN1: 'Siren',
  SMARTCAMERA1: 'Smart Camera',
  SMOKE2: 'Rökdetektor',
  VOICEBOX1: 'Directenhet',
};

class ClimateSensor extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { deviceArea, deviceType, temperature } = this.config;
    const name = deviceNames[deviceType] || deviceType;

    this.model = deviceType;
    this.name = VerisureAccessory.getUniqueAccessoryName(`${name} (${deviceArea})`);
    this.value = temperature;
  }

  getCurrentTemperature(callback) {
    this.log(`${this.name} (${this.serialNumber}): Getting current temperature...`);

    this.installation.getOverview()
      .then(overview =>
        overview.climateValues.find(device =>
          device.deviceLabel === this.serialNumber))
      .then((device) => {
        this.value = device.temperature;
        callback(null, this.value);
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.TemperatureSensor(this.name);
    this.service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = ClimateSensor;
