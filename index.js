const verisure = require('verisure')


var Accessory, Service, Characteristic, UUIDGen;

const PLUGIN_NAME = 'homebridge-verisure';
const PLATFORM_NAME = 'verisure';
const MANUFACTURER = 'Verisure';

const DEVICE_TYPES = {
  'VOICEBOX1': 'Directenhet',
  'SMOKE2': 'Rökdetektor',
  'SMARTPLUG': 'Smart plug'
}

let VERISURE_TOKEN = null;
let VERISURE_INSTALLATION = null;
let VERISURE_CALLS = {};


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


module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, VerisurePlatform, true);
}


const VerisurePlatform = function(log, config, api) {
  var platform = this;
  this.log = log;
  this.config = config;

  this.accessories = function(callback) {
    getVerisureInstallation(config, function(err) {
      if(err) return log(err);

      verisure.overview(VERISURE_TOKEN, VERISURE_INSTALLATION, function(err, overview) {
        if(err) return log(err);
        var devices = overview.climateValues.map(function(device) {
          return new VerisureAccessory(log, {
            name: `${DEVICE_TYPES[device.deviceType]} (${device.deviceArea})`,
            model: device.deviceType,
            serialNumber: device.deviceLabel,
            value: 0
          });
        });

        devices = devices.concat(overview.smartPlugs.map(function(device) {
          return new VerisureAccessory(log, {
            name: `${DEVICE_TYPES.SMARTPLUG} (${device.area})`,
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
    var that = this;

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
    var that = this;

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
    var accessoryInformation = new Service.AccessoryInformation();
    accessoryInformation
      .setCharacteristic(Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)

    var service = null;

    if(this.model == 'SMARTPLUG') {
      service = new Service.Switch(this.name);
      service
        .getCharacteristic(Characteristic.On)
        .on('get', this._getSwitchValue.bind(this))
        .on('set', this._setSwitchValue.bind(this))
        .value = this.value;
    }

    if(['VOICEBOX1', 'SMOKE2'].includes(this.model)) {
      service = new Service.TemperatureSensor(this.name);
      service
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this._getCurrentTemperature.bind(this));
    }

    return [accessoryInformation, service]
  }
}
