import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import { smartPlugStateOperation } from '../operations';
import type { VerisurePlatform } from '../platform';
import type { Overview, SmartPlugDevice } from '../types';
import { VerisureAccessoryHandler } from './base';
import type { AccessoryContext } from './base';

export class SmartPlug extends VerisureAccessoryHandler {
  private readonly service: Service;

  constructor(
    platform: VerisurePlatform,
    accessory: PlatformAccessory<AccessoryContext>,
    installation: VerisureInstallation,
    initial: SmartPlugDevice
  ) {
    super(platform, accessory, installation);

    const { Service, Characteristic } = this.hap;
    this.accessoryInformation.setCharacteristic(Characteristic.Model, 'SMARTPLUG');

    this.service = this.accessory.getService(Service.Switch)
      ?? this.accessory.addService(Service.Switch, accessory.displayName);

    this.service.getCharacteristic(Characteristic.On)
      .onGet(() => this.getSwitchState())
      .onSet((value) => this.setSwitchState(value));

    this.service.updateCharacteristic(Characteristic.On, SmartPlug.resolveSwitchState(initial.currentState));
  }

  private static resolveSwitchState(input: string): boolean {
    return input === 'ON';
  }

  private findDevice(overview: Overview): SmartPlugDevice | undefined {
    return overview.smartplugs?.find((smartplug) => smartplug.device.deviceLabel === this.serialNumber);
  }

  private async getSwitchState(): Promise<CharacteristicValue> {
    this.logPrefixed('Getting current switch state.', 'debug');
    const overview = await this.platform.poller(this.installation).getOverview();
    const device = this.findDevice(overview);
    if (!device) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return SmartPlug.resolveSwitchState(device.currentState);
  }

  private async setSwitchState(value: CharacteristicValue): Promise<void> {
    this.logPrefixed(`Setting switch state to: ${value}`);
    try {
      await this.installation.client(smartPlugStateOperation(this.serialNumber as string, value as boolean));
    } catch (error) {
      this.logPrefixed(`Error setting switch state: ${(error as Error).message}`, 'debug');
      throw error;
    }
  }

  protected onOverview(overview: Overview): void {
    const device = this.findDevice(overview);
    if (!device) {
      return;
    }
    this.service.updateCharacteristic(this.hap.Characteristic.On, SmartPlug.resolveSwitchState(device.currentState));
  }
}
