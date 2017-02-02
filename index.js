'use strict';

const verisure = require('verisure');


let Accessory,
    Service,
    Characteristic,
    UUIDGen;

const PLUGIN_NAME = 'homebridge-verisure';
const PLATFORM_NAME = 'verisure';
const MANUFACTURER = 'Verisure';

const DEVICE_TYPES = {
  'HUMIDITY1': 'Klimatdetektor',
  'SIREN1': 'Siren',
  'SMARTPLUG': 'Smart plug',
  'SMOKE2': 'Rökdetektor',
  'VOICEBOX1': 'Directenhet'
}

let VERISURE_TOKEN = null;
let VERISURE_INSTALLATION = null;
let VERISURE_CALLS = {};
let VERISURE_DEVICE_NAMES = []


const getVerisureInstallation = function(config, callback) {
  verisure.auth(config.email, config.password, function(err, token) {
    if(err) return callback(err);
    VERISURE_TOKEN = token;

    verisure.installations(token, config.email, function(err, installations) {
      if(err) return callback(err);
      VERISURE_INSTALLATION = installations[0];
      callback();
    });
  });
}

const getOverview = function(callback) {
  if(typeof VERISURE_CALLS.overview == 'undefined') {
    VERISURE_CALLS.overview = [];
  }
  VERISURE_CALLS.overview.push(callback);
  if(VERISURE_CALLS.overview.length > 1) {
    return;
  }
  verisure.overview(VERISURE_TOKEN, VERISURE_INSTALLATION, function(err, overview) {
    VERISURE_CALLS.overview.map(function(callback) {
      callback(err, overview);
    });
    VERISURE_CALLS.overview = [];
  });
}

const getUniqueName = function(name) {
  if(VERISURE_DEVICE_NAMES.includes(name)) {
    const match = name.match(/(.+) #(\d+)/) || [null, name, 1]
    return getUniqueName(`${match[1]} #${parseInt(match[2])+1}`);
  }
  else {
    VERISURE_DEVICE_NAMES.push(name)
    return name;
  }
}


module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, VerisurePlatform, true);
}


const VerisurePlatform = function(log, config, api) {
  const platform = this;
  this.log = log;
  this.config = config;

  this.accessories = function(callback) {
    getVerisureInstallation(config, function(err) {
      if(err) return log.error(err);

      verisure.overview(VERISURE_TOKEN, VERISURE_INSTALLATION, function(err, overview) {
        if(err) return log.error(err);
        let devices = overview.climateValues.map(function(device) {
          const deviceName = DEVICE_TYPES[device.deviceType] || device.deviceType
          return new VerisureAccessory(log, {
            name: getUniqueName(`${deviceName} (${device.deviceArea})`),
            model: device.deviceType,
            serialNumber: device.deviceLabel,
            value: 0
          });
        });

        devices = devices.concat(overview.smartPlugs.map(function(device) {
          return new VerisureAccessory(log, {
            name: getUniqueName(`${DEVICE_TYPES.SMARTPLUG} (${device.area})`),
            model: 'SMARTPLUG',
            serialNumber: device.deviceLabel,
            value: device.currentState == 'ON' ? 1 : 0
          });
        }));

        callback(devices);
      });
    })
  }
}


const VerisureAccessory = function(log, config) {
  this.log = log;
  this.config = config;

  this.name = config.name;
  this.model = config.model;
  this.serialNumber = config.serialNumber;
  this.value = config.value;
}


VerisureAccessory.prototype = {
  _getCurrentTemperature: function(callback) {
    this.log(`${this.name} (${this.serialNumber}): Getting current temperature...`);
    const that = this;

    getOverview(function(err, overview) {
      if(err) return callback(err);
      overview.climateValues.map(function(device) {
        if(device.deviceLabel != that.serialNumber) return;
        that.value = device.temperature;
        callback(err, that.value);
      });
    });
	},

  _getSwitchValue: function(callback) {
    this.log(`${this.name} (${this.serialNumber}): Getting current value...`);
    const that = this;

    getOverview(function(err, overview) {
      if(err) return callback(err);
      overview.smartPlugs.map(function(device) {
        if(device.deviceLabel != that.serialNumber) return;
        that.value = device.currentState == 'ON' ? 1 : 0;
        callback(err, that.value);
      });
    });
  },

  _setSwitchValue: function(value, callback) {
    this.log(`${this.name} (${this.serialNumber}): Setting current value to "${value}"...`);
    this.value = value;

    verisure._apiClient({
      method: 'POST',
      uri: `/installation/${VERISURE_INSTALLATION.giid}/smartplug/state`,
      headers: {
        'Cookie': `vid=${VERISURE_TOKEN}`,
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      json: [
        {
          deviceLabel: this.serialNumber,
          state: value == 1 ? true : false
        }
      ]
    }, callback);
  },

  getServices: function() {
    const accessoryInformation = new Service.AccessoryInformation();
    accessoryInformation
      .setCharacteristic(Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)

    let service = null;

    if(['SMARTPLUG'].includes(this.model)) {
      service = new Service.Switch(this.name);
      service
        .getCharacteristic(Characteristic.On)
        .on('get', this._getSwitchValue.bind(this))
        .on('set', this._setSwitchValue.bind(this))
        .value = this.value;
    }

    if(['HUMIDITY1', 'SIREN1', 'SMOKE2', 'VOICEBOX1'].includes(this.model)) {
      service = new Service.TemperatureSensor(this.name);
      service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this._getCurrentTemperature.bind(this));
    }

    if(!service) {
      this.log.error(`Device ${this.model} is not yet supported`);
    }

    return [accessoryInformation, service]
  }
}
