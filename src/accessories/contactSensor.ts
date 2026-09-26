import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import type { VerisurePlatform } from '../platform';
import type { DoorWindow, Overview } from '../types';
import { VerisureAccessoryHandler } from './base';
import type { AccessoryContext } from './base';

export class ContactSensor extends VerisureAccessoryHandler {
  private readonly service: Service;

  constructor(
    platform: VerisurePlatform,
    accessory: PlatformAccessory<AccessoryContext>,
    installation: VerisureInstallation
  ) {
    super(platform, accessory, installation);

    const { Service, Characteristic } = this.hap;
    this.service = this.accessory.getService(Service.ContactSensor)
      ?? this.accessory.addService(Service.ContactSensor, accessory.displayName);

    this.service.getCharacteristic(Characteristic.ContactSensorState)
      .onGet(() => this.getCurrentSensorState());
  }

  private static resolveSensorState(input: string): boolean {
    return input !== 'CLOSE';
  }

  private findDevice(overview: Overview): DoorWindow | undefined {
    return overview.doorWindows?.find((doorWindow) => doorWindow.device.deviceLabel === this.serialNumber);
  }

  private async getCurrentSensorState(): Promise<CharacteristicValue> {
    this.logPrefixed('Getting current sensor state.', 'debug');
    const overview = await this.platform.poller(this.installation).getOverview();
    const doorWindow = this.findDevice(overview);
    if (!doorWindow) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return ContactSensor.resolveSensorState(doorWindow.state);
  }

  protected onOverview(overview: Overview): void {
    const doorWindow = this.findDevice(overview);
    if (!doorWindow) {
      return;
    }
    this.service.updateCharacteristic(
      this.hap.Characteristic.ContactSensorState,
      ContactSensor.resolveSensorState(doorWindow.state)
    );
  }
}
