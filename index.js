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
  'DOORLOCK': 'Yale Doorman',
  'HUMIDITY1': 'Klimatdetektor',
  'SIREN1': 'Siren',
  'SMARTCAMERA1': 'Smart Camera',
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

  return homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, VerisurePlatform, true);
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

        if (overview && overview.doorLockStatusList){
           let locks = overview.doorLockStatusList.map(function(device){
              return new VerisureAccessory(log, {
                 name: getUniqueName(`${device.area}`),
                 model: 'DOORLOCK',
                 serialNumber: device.deviceLabel,
                 value: device.lockedState==='LOCKED' ? 1 : 0,
                 doorcode: config.doorcode,
                 category: 6 // Hardcoded from Accessory.Categories in Accessory.js of hap-nodejs
              });
           });
           devices = devices.concat(locks);
        }

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
  this.service = null;
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

  _getCurrentLockState: function(callback){
    this.log(`${this.name} (${this.serialNumber}): GETTING CURRENT LOCK STATE`);
    verisure._apiClient({
        method: 'GET',
        uri: `/installation/${VERISURE_INSTALLATION.giid}/doorlockstate/search`,
        headers: {
          'Cookie': `vid=${VERISURE_TOKEN}`,
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
    }, function (callback, error, response){
      this.log(`**** Response: getCurrentLockState: ${JSON.stringify(response)}`);
      if (error) callback(error);
      if (response && response.statusCode == 200){
        let body = JSON.parse(response.body);
        for (let doorlock of body){
          if (doorlock.deviceLabel == this.serialNumber){
            if (doorlock.motorJam){
              this.value=Characteristic.LockCurrentState.JAMMED;
              callback(null, this.value);
              break;
            } else {
              this.value = doorlock.currentLockState == "UNLOCKED" ? Characteristic.LockCurrentState.UNSECURED : Characteristic.LockCurrentState.SECURED ;
              callback(null, this.value);
              break;
            }
          }
        }
      }
    }.bind(this, callback));
  },

  _getTargetLockState: function(callback){
    this.log(`${this.name} (${this.serialNumber}): GETTING TARGET LOCK STATE.`);

    verisure._apiClient({
        method: 'GET',
        uri: `/installation/${VERISURE_INSTALLATION.giid}/doorlockstate/search`,
        headers: {
          'Cookie': `vid=${VERISURE_TOKEN}`,
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
    }, function(callback, error, response){
      this.log(`**** Response: getTargetLockState: ${JSON.stringify(response)}`);
      if (error) callback(error);
      if (response && response.statusCode == 200){
        let body = JSON.parse(response.body);
        for (let doorlock of body){
          if (doorlock.deviceLabel == this.serialNumber) {
            let targetLockState = doorlock.pendingLockState == "NONE" ? doorlock.currentLockState : doorlock.pendingLockState;
            callback(error, targetLockState == "UNLOCKED" ? Characteristic.LockTargetState.UNSECURED : Characteristic.LockTargetState.SECURED);
          }
        }
      }

    }.bind(this, callback));
  },

  _setTargetLockState: function(value, callback){
    this.log(`${this.name} (${this.serialNumber}): Setting TARGET LOCK STATE to "${value}"`);
    let actionValue = value ? "lock":"unlock";
    verisure._apiClient({
      method: 'PUT',
      uri: `/installation/${VERISURE_INSTALLATION.giid}/device/${this.serialNumber}/${actionValue}`,
      headers: {
        'Cookie': `vid=${VERISURE_TOKEN}`,
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      json:
      {
          "code": this.config.doorcode
      }
    }, function(value, callback, error, response){
      this.log(`***** Response from ${actionValue}-operation: ${JSON.stringify(response)}`);
      if (error != null) callback(error, response);
      if (response && response.statusCode != 200) {
        if (response.statusCode == 400 && response.body && response.body.errorCode == "VAL_00819"){
          this.service.setCharacteristic(Characteristic.LockCurrentState, value)
          this.value = value;
          callback (null);
        } else {
          callback(response);
        }
      } else {
        this._waitForLockStatusChangeResult(value, callback, response);
      }
    }.bind(this,value,callback))
  },

  _waitForLockStatusChangeResult: function(value, callback, response){
    setTimeout(function(value, callback, response){
      verisure._apiClient({
        method: 'GET',
        uri: `/installation/${VERISURE_INSTALLATION.giid}/doorlockstate/change/result/${response.body.doorLockStateChangeTransactionId}`,
        headers: {
          'Cookie': `vid=${VERISURE_TOKEN}`,
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
      }, function(value, origResponse, callback,error,response){
        if (error != null)
          this.log(`**** ERROR: ${JSON.stringify(error)}`);

        this.log(`**** Response: Doorlockstate: ${JSON.stringify(response)}`);
        let body = JSON.parse(response.body);
        if (body.result == "NO_DATA"){
          this._waitForLockStatusChangeResult(value, callback, origResponse);
        } else {
          this.service.setCharacteristic(Characteristic.LockCurrentState, value)
          this.value = value;
          callback (null);
        }
      }.bind(this, value, response, callback));
    }.bind(this, value, callback, response)
    ,200);
  },
  getServices: function() {
    const accessoryInformation = new Service.AccessoryInformation();
    accessoryInformation
      .setCharacteristic(Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(Characteristic.Model, DEVICE_TYPES[this.model] || this.model)
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

    if (['DOORLOCK'].includes(this.model)){
      service = new Service.LockMechanism(this.name);
      service
        .getCharacteristic(Characteristic.LockCurrentState)
        .on('get', this._getCurrentLockState.bind(this));

      service
        .getCharacteristic(Characteristic.LockTargetState)
        .on('get', this._getTargetLockState.bind(this))
        .on('set', this._setTargetLockState.bind(this));

      this.service = service;
    }

    if(['HUMIDITY1', 'SIREN1', 'SMARTCAMERA1' ,'SMOKE2', 'VOICEBOX1'].includes(this.model)) {
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
