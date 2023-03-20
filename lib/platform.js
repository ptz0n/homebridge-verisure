const Verisure = require('verisure');

const accessoryClasses = require('./accessories');
const { overviewOperation } = require('./operations');

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
      VERISURE_COOKIES,
      VERISURE_TOKEN, // Deprecated.
    } = process.env;

    const {
      alarmCode,
      doorcode, doorCode,
      email,
      cookies,
      password,
      installations = [],
      pollInterval = 60,
      showAutoLockSwitch = true,
      showAudioSwitch = true,
      audioOffValue = 'LOW',
      audioOnValue = 'HIGH',
      token, // Deprecated.
    } = config;

    this.config = {
      alarmCode: VERISURE_ALARM_CODE || alarmCode,
      doorCode: VERISURE_DOOR_CODE || doorcode || doorCode,
      email: VERISURE_EMAIL || email,
      password: VERISURE_PASSWORD || password,
      cookies: (VERISURE_COOKIES && VERISURE_COOKIES.split(';')) || cookies,
      installations,
      pollInterval,
      showAutoLockSwitch,
      showAudioSwitch,
      audioOffValue,
      audioOnValue,
    };

    this.homebridge = homebridge;
    this.logger = logger;

    if (VERISURE_TOKEN || token) {
      this.logger.error('DEPRECATED: Property "token" in config. Please see README to get and configure "cookies".');
    }

    this.verisure = new Verisure(
      this.config.email,
      this.config.password,
      this.config.cookies,
    );
  }

  static init(homebridgeRef) {
    homebridge = homebridgeRef;
  }

  static overviewToDeviceConfigs(overview) {
    const alarm = overview.armState
      ? [{ statusType: overview.armState.statusType }]
      : [];

    // TODO: Use renaming in query instead.
    const deviceTypes = {
      alarm,
      climateSensor: overview.climates || [],
      contactSensor: overview.doorWindows || [],
      doorLock: overview.doorlocks || [],
      smartPlug: overview.smartplugs || [],
    };

    return deviceTypes;
  }

  overviewToAccessories([installation, { installation: overview }]) {
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
    try {
      if (!this.verisure.cookies.length) {
        await this.verisure.getToken();

        if (!this.verisure.getCookie('vid')) {
          this.logger.error('MFA is enabled for user. Please see README.');
          return callback([]);
        }
      }

      this.installations = (await this.verisure.getInstallations())
        // Filter out installations based on configuration.
        .filter((installation) => this.config.installations.length === 0
          || this.config.installations.includes(installation.config.alias));
    } catch (error) {
      this.logger.error(`Unable to get installations. Please check configured credentials: ${error.message}`);
      return callback([]);
    }

    if (this.installations.length === 0) {
      this.logger.error(`No installations found matching config: ${JSON.stringify(this.config.installations)}`);
      return callback([]);
    }

    const overviews = await Promise.all(
      this.installations.map((installation) => Promise.all([
        installation,
        installation.client(overviewOperation),
      ])),
    );

    try {
      const accessoryLists = overviews.map(this.overviewToAccessories.bind(this));
      return callback(accessoryLists.reduce((a, b) => [...a, ...b]));
    } catch (error) {
      this.logger.error((error.response && error.response.data) || error.message);
      return callback([]);
    }
  }
}

module.exports = VerisurePlatform;
