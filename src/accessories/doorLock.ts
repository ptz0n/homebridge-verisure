import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import { memoizeAsync } from '../cache';
import {
  doorLockConfigOperation,
  doorLockOperation,
  doorLockUpdateConfigOperation,
  doorUnlockOperation,
  pollLockStateOperation,
} from '../operations';
import { DOOR_LOCK_CONFIG_CACHE_TTL_MS } from '../settings';
import type { VerisurePlatform } from '../platform';
import type { DoorLockConfiguration, DoorLockDevice, Overview, SmartLockConfigEntry } from '../types';
import { VerisureAccessoryHandler } from './base';
import type { AccessoryContext } from './base';

type LockState = 'LOCKED' | 'UNLOCKED';

export class DoorLock extends VerisureAccessoryHandler {
  private readonly lockService: Service;

  private readonly autoLockService?: Service;

  private readonly audioService?: Service;

  private readonly doorCode: string;

  /** The lock state we're actively trying to reach, if any. Cleared as soon
   * as the change settles (success or failure) so getTargetLockState() falls
   * straight back to the device's actual state - keeping it "stuck" here
   * indefinitely was the cause of the Yale-lock report/reconcile loop that
   * burned through the daily API quota in issues #159, #173, #181, #168. */
  private pendingTargetState?: LockState;

  private readonly getLockConfig: () => Promise<SmartLockConfigEntry>;

  constructor(
    platform: VerisurePlatform,
    accessory: PlatformAccessory<AccessoryContext>,
    installation: VerisureInstallation
  ) {
    super(platform, accessory, installation);

    this.doorCode = String(this.platformConfig.doorCode ?? this.platformConfig.doorcode ?? '');

    this.getLockConfig = memoizeAsync(async () => {
      const { installation: { smartLocks: [smartLock] } } = await this.installation
        .client<{ installation: { smartLocks: SmartLockConfigEntry[] } }>(doorLockConfigOperation(this.serialNumber as string));
      return smartLock;
    }, DOOR_LOCK_CONFIG_CACHE_TTL_MS);

    const { Service, Characteristic } = this.hap;

    this.lockService = this.accessory.getService(Service.LockMechanism)
      ?? this.accessory.addService(Service.LockMechanism, accessory.displayName);
    this.lockService.getCharacteristic(Characteristic.LockCurrentState)
      .onGet(() => this.getCurrentLockState());
    this.lockService.getCharacteristic(Characteristic.LockTargetState)
      .onGet(() => this.getTargetLockState())
      .onSet((value) => this.setTargetLockState(value));

    if (this.platformConfig.showAutoLockSwitch !== false) {
      this.autoLockService = this.accessory.getServiceById(Service.Switch, 'auto-lock')
        ?? this.accessory.addService(Service.Switch, `${accessory.displayName} Auto-lock`, 'auto-lock');
      this.autoLockService.getCharacteristic(Characteristic.On)
        .onGet(() => this.getAutoLockState())
        .onSet((value) => this.setAutoLockState(value));
    }

    if (this.platformConfig.showAudioSwitch !== false) {
      this.audioService = this.accessory.getServiceById(Service.Switch, 'audio')
        ?? this.accessory.addService(Service.Switch, `${accessory.displayName} Audio`, 'audio');
      this.audioService.getCharacteristic(Characteristic.On)
        .onGet(() => this.getAudioState())
        .onSet((value) => this.setAudioState(value));
    }
  }

  private resolveCurrentLockState({ currentLockState, motorJam }: DoorLockDevice): CharacteristicValue {
    const { LockCurrentState } = this.hap.Characteristic;
    if (motorJam) {
      return LockCurrentState.JAMMED;
    }
    return currentLockState === 'LOCKED' ? LockCurrentState.SECURED : LockCurrentState.UNSECURED;
  }

  private findDevice(overview: Overview): DoorLockDevice | undefined {
    return overview.doorlocks?.find((doorlock) => doorlock.device.deviceLabel === this.serialNumber);
  }

  private async getDoorLock(): Promise<DoorLockDevice> {
    this.logPrefixed('Getting current lock state.', 'debug');
    const overview = await this.platform.poller(this.installation).getOverview();
    const doorLock = this.findDevice(overview);
    if (!doorLock) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return doorLock;
  }

  private async getCurrentLockState(): Promise<CharacteristicValue> {
    return this.resolveCurrentLockState(await this.getDoorLock());
  }

  private async getTargetLockState(): Promise<CharacteristicValue> {
    this.logPrefixed('Getting target lock state.', 'debug');
    const { LockTargetState } = this.hap.Characteristic;
    const { currentLockState } = await this.getDoorLock();
    const targetLockState = this.pendingTargetState ?? currentLockState;
    return targetLockState === 'LOCKED' ? LockTargetState.SECURED : LockTargetState.UNSECURED;
  }

  private async setTargetLockState(value: CharacteristicValue): Promise<void> {
    this.logPrefixed(`Setting target lock state to: ${value}`);

    const { LockCurrentState } = this.hap.Characteristic;
    this.pendingTargetState = value === LockCurrentState.SECURED ? 'LOCKED' : 'UNLOCKED';
    const targetLockState = this.pendingTargetState;
    const operation = targetLockState === 'LOCKED' ? doorLockOperation : doorUnlockOperation;

    try {
      const { transactionId } = await this.installation
        .client<{ transactionId: string }>(operation(this.serialNumber as string, this.doorCode));
      await this.resolveChangeResult(pollLockStateOperation(transactionId, this.serialNumber as string, targetLockState));
    } catch (error) {
      const alreadyAtTarget = (error as { errors?: Array<{ data?: { errorCode?: string } }> }).errors
        ?.some(({ data }) => data?.errorCode === 'VAL_00819');
      if (!alreadyAtTarget) {
        throw error;
      }
      // Lock was already at the desired state - not an error.
    } finally {
      this.pendingTargetState = undefined;
    }

    setImmediate(() => {
      this.lockService.updateCharacteristic(LockCurrentState, value);
    });
  }

  private resolveAutoLockState(config: DoorLockConfiguration): boolean {
    return config.autoLockEnabled === true;
  }

  private async getAutoLockState(): Promise<CharacteristicValue> {
    this.logPrefixed('Getting current auto lock config.', 'debug');
    const { configuration } = await this.getLockConfig();
    return this.resolveAutoLockState(configuration);
  }

  private async setAutoLockState(value: CharacteristicValue): Promise<void> {
    this.logPrefixed(`Setting auto lock to: ${value}`);
    try {
      await this.installation.client(doorLockUpdateConfigOperation(this.serialNumber as string, { autoLockEnabled: value }));
    } catch (error) {
      this.logPrefixed((error as Error).message, 'debug');
      throw error;
    }
  }

  private async getAudioState(): Promise<CharacteristicValue> {
    this.logPrefixed('Getting current audio config.', 'debug');
    const { configuration } = await this.getLockConfig();
    if (configuration.volume === undefined) {
      // Non-Yale locks (e.g. DanaLock) don't report a volume at all.
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return configuration.volume !== this.platformConfig.audioOffValue;
  }

  private async setAudioState(value: CharacteristicValue): Promise<void> {
    const volume = value ? this.platformConfig.audioOnValue : this.platformConfig.audioOffValue;
    this.logPrefixed(`Setting audio volume to: ${volume}`);
    try {
      await this.installation.client(doorLockUpdateConfigOperation(this.serialNumber as string, { volume }));
    } catch (error) {
      this.logPrefixed((error as Error).message, 'debug');
      throw error;
    }
  }

  protected onOverview(overview: Overview): void {
    const doorLock = this.findDevice(overview);
    if (!doorLock) {
      return;
    }
    this.lockService.updateCharacteristic(this.hap.Characteristic.LockCurrentState, this.resolveCurrentLockState(doorLock));
    if (!this.pendingTargetState) {
      const { LockTargetState } = this.hap.Characteristic;
      this.lockService.updateCharacteristic(
        LockTargetState,
        doorLock.currentLockState === 'LOCKED' ? LockTargetState.SECURED : LockTargetState.UNSECURED
      );
    }
  }
}
