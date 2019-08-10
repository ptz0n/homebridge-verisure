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

    const { deviceArea, deviceType } = this.config;
    const _ = i18n(this.installation.locale);
    const name = _(deviceNames[deviceType]) || deviceType;

    this.model = deviceType;
    this.name = VerisureAccessory.getUniqueAccessoryName(`${name} (${deviceArea})`);
  }

  getCurrentPropertyValue(property, callback) {
    this.log(`Getting current ${property} value.`);

    this.installation.getOverview()
      .then((overview) => overview.climateValues
        .find((device) => device.deviceLabel === this.serialNumber))
      .then((device) => {
        callback(null, device[property]);
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    const services = [];

    services.push(this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model));

    if (this.config.temperature) {
      this.temperatureService = new Service.TemperatureSensor(this.name);
      this.temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -40.0, maxValue: 60.0 })
        .on('get', this.getCurrentPropertyValue.bind(this, 'temperature'));
      services.push(this.temperatureService);
    }

    if (this.config.humidity) {
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
