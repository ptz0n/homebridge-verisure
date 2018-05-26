const VerisureAccessory = require('./verisure');
const i18n = require('../i18n');

const deviceNames = {
  HOMEPAD1: 'VoiceBox',
  HUMIDITY1: 'Climate sensor',
  SIREN1: 'Siren',
  SMARTCAMERA1: 'SmartCam',
  SMOKE2: 'Smoke detector',
  SMOKE3: 'Smoke detector',
  VOICEBOX1: 'VoiceBox',
  WATER1: 'Water detector',
};

class ClimateSensor extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { deviceArea, deviceType, temperature } = this.config;
    const _ = i18n(this.installation.locale);
    const name = _(deviceNames[deviceType]) || deviceType;

    this.model = deviceType;
    this.name = VerisureAccessory.getUniqueAccessoryName(`${name} (${deviceArea})`);
    this.value = temperature;
  }

  getCurrentTemperature(callback) {
    this.log('Getting current temperature.');

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
