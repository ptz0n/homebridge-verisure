const uniqueAccessoryNames = [];

class VerisureAccessory {
  constructor(homebridge, log, config, installation, platformConfig) {
    this.homebridge = homebridge;
    this.log = log;
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
}

module.exports = VerisureAccessory;
