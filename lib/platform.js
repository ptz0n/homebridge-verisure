const Verisure = require('verisure');

const accessoryClasses = require('./accessories');

let homebridge = null;

class VerisurePlatform {
  constructor(logger, config) {
    if (!homebridge) {
      throw Error('Module not initiated.');
    }

    const {
      VERISURE_ALARM_CODE,
      VERISURE_DOOR_CODE,
      VERISURE_EMAIL,
      VERISURE_PASSWORD,
      VERISURE_TOKEN,
    } = process.env;

    const {
      alarmCode,
      doorcode, doorCode,
      email,
      token,
      password,
      pollInterval = 60,
    } = config;

    this.config = {
      alarmCode: VERISURE_ALARM_CODE || alarmCode,
      doorCode: VERISURE_DOOR_CODE || doorcode || doorCode,
      email: VERISURE_EMAIL || email,
      password: VERISURE_PASSWORD || password,
      token: VERISURE_TOKEN || token,
      pollInterval,
    };

    this.homebridge = homebridge;
    this.logger = logger;

    this.verisure = new Verisure(
      this.config.email,
      this.config.password,
      this.config.token && [this.config.token],
    );
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
          this.config,
        ));
      });
    });

    return accessories;
  }

  async accessories(callback) {
    if (!this.verisure.cookies.length) {
      await this.verisure.getToken();

      if (!this.verisure.getCookie('vid')) {
        this.logger.error('MFA is enabled for user. Please see README.');
        return callback([]);
      }
    }

    const installations = await this.verisure.getInstallations();

    return Promise.all(
      installations.map((installation) => Promise.all([
        installation,
        installation.getOverview(),
      ])),
    )
      .then((overviews) => {
        const accessoryLists = overviews.map(this.overviewToAccessories.bind(this));
        callback(accessoryLists.reduce((a, b) => [...a, ...b]));
      })
      .catch((error) => {
        this.logger.error((error.response && error.response.data) || error.message);
        callback([]);
      });
  }
}

module.exports = VerisurePlatform;
