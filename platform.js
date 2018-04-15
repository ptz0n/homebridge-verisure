const Verisure = require('verisure');

const accessoryClasses = require('./accessories');

let homebridge = null;

class VerisurePlatform {
  constructor(log, config) {
    if (!homebridge) {
      throw Error('Module not initiated.');
    }

    this.config = config;
    this.homebridge = homebridge;
    this.log = log;

    this.verisure = new Verisure(this.config.email, config.password);
  }

  static init(homebridgeRef) {
    homebridge = homebridgeRef;
  }

  static overviewToDeviceConfigs(overview) {
    const deviceTypes = {
      climateSensor: overview.climateValues || [],
      // doorLock: overview.doorLockStatusList || [],
      // doorWindowSensor: (overview.doorWindow && overview.doorWindow.doorWindowDevice) || [],
      smartPlug: overview.smartPlugs || [],
    };

    // console.log('overview', overview);

    return deviceTypes;
  }

  overviewToAccessories([installation, overview]) {
    const accessories = [];
    const deviceTypes = VerisurePlatform.overviewToDeviceConfigs(overview);

    Object.keys(deviceTypes).forEach((deviceType) => {
      deviceTypes[deviceType].forEach((deviceConfig) => {
        accessories.push(new accessoryClasses[deviceType](
          homebridge,
          this.log,
          deviceConfig,
          installation,
        ));
      });
    });

    return accessories;
  }

  accessories(callback) {
    this.verisure.getToken()
      .then(() => this.verisure.getInstallations(), (error) => { throw Error(error); })
      .then(installations =>
        Promise.all(installations.map(installation =>
          Promise.all([installation, installation.getOverview()]))))
      .then((overviews) => {
        const accessoryLists = overviews.map(this.overviewToAccessories.bind(this));
        callback(accessoryLists.reduce((a, b) => [...a, ...b]));
      })
      .catch((error) => {
        this.log.error(error);
        callback(error);
      });
  }
}

module.exports = VerisurePlatform;
