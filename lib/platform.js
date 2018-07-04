const Verisure = require('verisure');

const accessoryClasses = require('./accessories');

let homebridge = null;

class VerisurePlatform {
  constructor(logger, config) {
    if (!homebridge) {
      throw Error('Module not initiated.');
    }

    const {
      alarmCode,
      doorcode, doorCode,
      email,
      password,
      pollInterval = 60,
    } = config;
    this.config = {
      alarmCode,
      doorCode: doorcode || doorCode,
      email,
      password,
      pollInterval,
    };

    this.homebridge = homebridge;
    this.logger = logger;

    this.verisure = new Verisure(email, password);
  }

  static init(homebridgeRef) {
    homebridge = homebridgeRef;
  }

  static overviewToDeviceConfigs(overview) {
    const alarm = overview.armState ? [{ statusType: overview.armState.statusType }] : [];

    const deviceTypes = {
      alarm,
      climateSensor: overview.climateValues || [],
      contactSensor: (overview.doorWindow && overview.doorWindow.doorWindowDevice) || [],
      doorLock: overview.doorLockStatusList || [],
      smartPlug: overview.smartPlugs || [],
    };

    return deviceTypes;
  }

  overviewToAccessories([installation, overview]) {
    const accessories = [];
    const deviceTypes = VerisurePlatform.overviewToDeviceConfigs(overview);

    Object.keys(deviceTypes).forEach((deviceType) => {
      if (deviceType === 'alarm' && !this.config.alarmCode) {
        return;
      }

      if (deviceType === 'doorLock' && !this.config.doorcode && !this.config.doorCode) {
        return;
      }

      deviceTypes[deviceType].forEach((deviceConfig) => {
        accessories.push(new accessoryClasses[deviceType](
          homebridge,
          this.logger,
          deviceConfig,
          installation,
          this.config
        ));
      });
    });

    return accessories;
  }

  accessories(callback) {
    this.verisure.getToken()
      .then(() => this.verisure.getInstallations(), (error) => { throw Error(error); })
      .then(installations => Promise.all(
        installations.map(installation => Promise.all([
          installation,
          installation.getOverview(),
        ]))
      ))
      .then((overviews) => {
        const accessoryLists = overviews.map(this.overviewToAccessories.bind(this));
        callback(accessoryLists.reduce((a, b) => [...a, ...b]));
      })
      .catch((error) => {
        this.logger.error(error);
        callback(error);
      });
  }
}

module.exports = VerisurePlatform;
