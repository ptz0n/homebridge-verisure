import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { VerisureInstallation } from 'verisure';

import { armAwayOperation, armHomeOperation, disarmOperation, pollArmStateOperation } from '../operations';
import type { VerisurePlatform } from '../platform';
import type { ArmState, Overview } from '../types';
import { VerisureAccessoryHandler } from './base';
import type { AccessoryContext } from './base';

type TargetArmState = 'ARMED_AWAY' | 'ARMED_HOME' | 'DISARMED';

export class Alarm extends VerisureAccessoryHandler {
  private readonly service: Service;

  private readonly alarmCode: string;

  private readonly forceArm: boolean;

  /** Verisure reports transitional statuses (e.g. `CHANGE_IN_PROGRESS`
   * while an arm/disarm is mid-flight) that have no HomeKit equivalent.
   * Falling back to the last resolved state avoids surfacing a read error
   * for what is a normal, brief condition, and is more robust than
   * enumerating every transitional status Verisure might ever send. */
  private lastKnownState?: number;

  constructor(platform: VerisurePlatform, accessory: PlatformAccessory<AccessoryContext>, installation: VerisureInstallation) {
    super(platform, accessory, installation);

    this.alarmCode = String(this.platformConfig.alarmCode);
    this.forceArm = this.platformConfig.forceArm !== false;

    const { Service, Characteristic } = this.hap;
    this.accessoryInformation.setCharacteristic(Characteristic.Model, 'ALARM');

    this.service = this.accessory.getService(Service.SecuritySystem)
      ?? this.accessory.addService(Service.SecuritySystem, accessory.displayName);

    this.service.getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(() => this.getCurrentAlarmState());

    const targetState = this.service.getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(() => this.getCurrentAlarmState())
      .onSet((value) => this.setTargetAlarmState(value));

    // There is no "Night" mode in this alarm system; some HomeKit clients
    // (e.g. Eve) let a user pick it anyway despite it being filtered out of
    // validValues here, which used to crash the plugin outright (#85) -
    // setTargetAlarmState() below now rejects it with a proper HAP error
    // instead of throwing synchronously.
    const { NIGHT_ARM } = Characteristic.SecuritySystemTargetState;
    targetState.setProps({
      validValues: targetState.props.validValues?.filter((state) => state !== NIGHT_ARM),
    });
  }

  private armStateMap(): Record<TargetArmState, number> {
    const { SecuritySystemCurrentState } = this.hap.Characteristic;
    return {
      ARMED_AWAY: SecuritySystemCurrentState.AWAY_ARM,
      ARMED_HOME: SecuritySystemCurrentState.STAY_ARM,
      DISARMED: SecuritySystemCurrentState.DISARMED,
    };
  }

  private toHomeKitState(statusType: string): number {
    const value = this.armStateMap()[statusType as TargetArmState];
    if (value === undefined) {
      throw new Error(`Cannot resolve arm state from unknown Verisure status: ${statusType}`);
    }
    return value;
  }

  /** Resolves the current HomeKit state for a Verisure status, remembering
   * it for next time. Falls back to the last known state - rather than
   * erroring - for a transitional or otherwise unrecognized status. */
  private resolveCurrentState(statusType: string): number {
    try {
      this.lastKnownState = this.toHomeKitState(statusType);
    } catch (error) {
      if (this.lastKnownState === undefined) {
        throw error;
      }
      this.logPrefixed(`${(error as Error).message} - reporting the last known state instead.`, 'debug');
    }
    return this.lastKnownState;
  }

  private toVerisureState(value: CharacteristicValue): TargetArmState {
    const map = this.armStateMap();
    const match = (Object.keys(map) as TargetArmState[]).find((key) => map[key] === value);
    if (!match) {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.INVALID_VALUE_IN_REQUEST);
    }
    return match;
  }

  private async getCurrentAlarmState(): Promise<CharacteristicValue> {
    this.logPrefixed('Getting current alarm state.', 'debug');
    const overview = await this.platform.poller(this.installation).getOverview();
    if (!overview.armState) {
      this.logPrefixed(`No armState in overview; last known state: ${this.lastKnownState}`, 'debug');
      if (this.lastKnownState !== undefined) {
        return this.lastKnownState;
      }
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    try {
      const value = this.resolveCurrentState(overview.armState.statusType);
      this.logPrefixed(`Resolved current alarm state: ${value} (raw Verisure status: ${overview.armState.statusType})`, 'debug');
      return value;
    } catch {
      throw new this.hap.HapStatusError(this.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  private async setTargetAlarmState(value: CharacteristicValue): Promise<void> {
    this.logPrefixed(`Setting target alarm state to: ${value}`);

    const targetArmState = this.toVerisureState(value);
    const operation = {
      ARMED_AWAY: () => armAwayOperation(this.alarmCode, this.forceArm),
      ARMED_HOME: () => armHomeOperation(this.alarmCode, this.forceArm),
      DISARMED: () => disarmOperation(this.alarmCode),
    }[targetArmState]();

    const { transactionId } = await this.installation.client<{ transactionId: string }>(operation);
    await this.resolveChangeResult(pollArmStateOperation(transactionId, targetArmState));

    this.lastKnownState = value as number;
    // A stale cached overview from just before this change must not answer
    // the read HomeKit does right after to confirm it (see OverviewPoller#invalidate).
    this.platform.poller(this.installation).invalidate();
    setImmediate(() => {
      this.service.updateCharacteristic(this.hap.Characteristic.SecuritySystemCurrentState, value);
    });
  }

  protected onOverview(overview: Overview): void {
    const { armState } = overview;
    if (!armState) {
      return;
    }
    try {
      const value = this.resolveCurrentState((armState as ArmState).statusType);
      this.service.updateCharacteristic(this.hap.Characteristic.SecuritySystemCurrentState, value);
    } catch (error) {
      this.logPrefixed((error as Error).message, 'debug');
    }
  }
}
