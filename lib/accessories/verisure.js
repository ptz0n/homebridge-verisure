const uniqueAccessoryNames = [];

class VerisureAccessory {
  constructor(homebridge, logger, config, installation, platformConfig) {
    this.homebridge = homebridge;
    this.logger = logger;
    this.config = config;
    this.installation = installation;
    this.platformConfig = platformConfig;

    this.serialNumber = config.device && config.device.deviceLabel;

    this.value = null;
    this.service = null;
    this.pollCharacteristics = [];

    const { Characteristic, Service } = homebridge.hap;

    this.accessoryInformation = new Service.AccessoryInformation();
    this.accessoryInformation
      .setCharacteristic(Characteristic.Manufacturer, 'Verisure')
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

    if (platformConfig && platformConfig.pollInterval) {
      setInterval(() => {
        this.pollCharacteristics.forEach((characteristic) => characteristic.getValue());
      }, platformConfig.pollInterval * 1000);
    }
  }

  static getUniqueAccessoryName(name) {
    if (uniqueAccessoryNames.includes(name)) {
      const match = name.match(/(.+) #(\d+)/) || [null, name, 1];
      return VerisureAccessory.getUniqueAccessoryName(`${match[1]} #${parseInt(match[2], 10) + 1}`);
    }
    uniqueAccessoryNames.push(name);
    return name;
  }

  resolveChangeResult(operation) {
    this.log(`Resolving: ${operation.operationName}`);
    // TODO: Handle max retries

    return this.installation.client(operation)
      .then(({ installation: { pollResult: { result } } }) => {
        this.log(`Got "${result}" back from: ${operation.operationName}`);
        if (result === null) {
          return new Promise((resolve) => setTimeout(
            () => resolve(this.resolveChangeResult(operation)),
            200,
          ));
        }
        return result;
      });
  }

  log(message, level = 'info') {
    return this.logger[level](`${this.installation.config.alias} ${this.name}: ${message}`);
  }
}

module.exports = VerisureAccessory;
