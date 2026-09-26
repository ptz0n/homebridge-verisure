import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import type { VerisurePlatform } from '../platform';
import type { Climate, Overview } from '../types';
import { VerisureAccessoryHandler } from './base';
import type { AccessoryContext } from './base';

const isNumber = (value: unknown): value is number => typeof value === 'number';

export class ClimateSensor extends VerisureAccessoryHandler {
  private temperatureService?: Service;

  private humidityService?: Service;

  constructor(
    platform: VerisurePlatform,
    accessory: PlatformAccessory<AccessoryContext>,
    installation: VerisureInstallation,
    initial: Climate
  ) {
    super(platform, accessory, installation);

    const label = initial.device.gui?.label ?? 'UNKNOWN';

    const { Characteristic, Service } = this.hap;
    this.accessoryInformation.setCharacteristic(Characteristic.Model, label);

    // Verisure reports an unsupported reading as an explicit `null`, not a
    // missing field - e.g. VoiceBox devices have a `humidityValue: null`.
    // Checking only `!== undefined` let `null` through, which HomeKit
    // rejects outright for these characteristics.
    if (isNumber(initial.temperatureValue)) {
      this.temperatureService = this.accessory.getService(Service.TemperatureSensor)
        ?? this.accessory.addService(Service.TemperatureSensor, accessory.displayName);
      this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({ minValue: -40.0, maxValue: 60.0 })
        .onGet(() => this.getCurrentValue('temperatureValue'));
    }

    if (isNumber(initial.humidityValue)) {
      this.humidityService = this.accessory.getService(Service.HumiditySensor)
        ?? this.accessory.addService(Service.HumiditySensor, accessory.displayName);
      this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .onGet(() => this.getCurrentValue('humidityValue'));
    }
  }

  private findDevice(overview: Overview): Climate | undefined {
    return overview.climates?.find((climate) => climate.device.deviceLabel === this.serialNumber);
  }

  private async getCurrentValue(property: 'temperatureValue' | 'humidityValue'): Promise<CharacteristicValue> {
    this.logPrefixed(`Getting current ${property} value.`, 'debug');
    const overview = await this.platform.poller(this.installation).getOverview();
    const device = this.findDevice(overview);
    const value = device?.[property];
    if (!isNumber(value)) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return value;
  }

  protected onOverview(overview: Overview): void {
    const device = this.findDevice(overview);
    if (!device) {
      return;
    }
    const { Characteristic } = this.hap;
    if (this.temperatureService && isNumber(device.temperatureValue)) {
      this.temperatureService.updateCharacteristic(Characteristic.CurrentTemperature, device.temperatureValue);
    }
    if (this.humidityService && isNumber(device.humidityValue)) {
      this.humidityService.updateCharacteristic(Characteristic.CurrentRelativeHumidity, device.humidityValue);
    }
  }
}
