const uniqueAccessoryNames = [];

class VerisureAccessory {
  constructor(homebridge, logger, config, installation, platformConfig) {
    this.homebridge = homebridge;
    this.logger = logger;
    this.config = config;
    this.installation = installation;
    this.platformConfig = platformConfig;

    this.serialNumber = config.deviceLabel;

    this.value = null;
    this.service = null;

    const { Characteristic, Service } = homebridge.hap;

    this.accessoryInformation = new Service.AccessoryInformation();
    this.accessoryInformation
      .setCharacteristic(Characteristic.Manufacturer, 'Verisure')
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);
  }

  static getUniqueAccessoryName(name) {
    if (uniqueAccessoryNames.includes(name)) {
      const match = name.match(/(.+) #(\d+)/) || [null, name, 1];
      return VerisureAccessory.getUniqueAccessoryName(`${match[1]} #${parseInt(match[2], 10) + 1}`);
    }
    uniqueAccessoryNames.push(name);
    return name;
  }

  resolveChangeResult(uri) {
    this.log(`Resolving: ${uri}`);
    // TODO: Handle max retries

    return this.installation.client({ uri }).then(({ result }) => {
      this.log(`Got "${result}" back from: ${uri}`);
      if (typeof result === 'undefined' || result === 'NO_DATA') {
        return new Promise(resolve => setTimeout(() =>
          resolve(this.resolveChangeResult(uri)), 200));
      }
      return result;
    });
  }

  log(message) {
    return this.logger('info', `${this.name}: ${message}`);
  }
}

module.exports = VerisureAccessory;
