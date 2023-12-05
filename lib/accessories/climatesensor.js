const VerisureAccessory = require('./verisure');
const { overviewOperation } = require('../operations');
const i18n = require('../i18n');

const deviceNames = {
  HOMEPAD: 'VoiceBox',
  HUMIDITY: 'Climate sensor',
  SIREN: 'Siren',
  SMOKE: 'Smoke detector',
  VOICEBOX: 'VoiceBox',
  // TODO: Old ones, not verified from GraphQL.
  SMARTCAMERA1: 'SmartCam',
  WATER1: 'Water detector',
};

class ClimateSensor extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { device: { area, gui: { label } } } = this.config;
    const _ = i18n(this.installation.locale);
    const name = _(deviceNames[label]) || label;

    this.model = label;
    this.name = VerisureAccessory.getUniqueAccessoryName(`${name} - ${area}`);
  }

  getCurrentPropertyValue(property, callback) {
    this.log(`Getting current ${property} value.`);

    this.installation.client(overviewOperation)
      .then((overview) => overview.installation.climates
        .find((climate) => climate.device.deviceLabel === this.serialNumber))
      .then((device) => {
        callback(null, device[`${property}Value`]);
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    const services = [];

    services.push(this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model));

    if (this.config.temperatureValue) {
      this.temperatureService = new Service.TemperatureSensor(this.name);
      this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -40.0, maxValue: 60.0 })
        .on('get', this.getCurrentPropertyValue.bind(this, 'temperature'));
      services.push(this.temperatureService);
    }

    if (this.config.humidityValue) {
      this.humidityService = new Service.HumiditySensor(this.name);
      this.humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getCurrentPropertyValue.bind(this, 'humidity'));
      services.push(this.humidityService);
    }

    return services;
  }
}

module.exports = ClimateSensor;
