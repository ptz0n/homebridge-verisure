import type { Logger, PlatformAccessory, Service } from 'homebridge';
import type { GraphqlOperation, VerisureInstallation } from 'verisure';

import { CHANGE_RESULT_POLL_INTERVAL_MS, CHANGE_RESULT_TIMEOUT_MS } from '../settings';
import type { AccessoryType, Overview, VerisurePlatformConfig } from '../types';
import type { VerisurePlatform } from '../platform';

export interface AccessoryContext {
  deviceType: AccessoryType;
  deviceLabel?: string;
  installationGiid: string;
}

/**
 * Common plumbing shared by every accessory type: logging, the
 * AccessoryInformation service, and the arm/lock change-result poller.
 */
export abstract class VerisureAccessoryHandler {
  protected readonly log: Logger;

  protected readonly hap: VerisurePlatform['api']['hap'];

  protected readonly platformConfig: VerisurePlatformConfig;

  protected readonly serialNumber?: string;

  protected readonly accessoryInformation: Service;

  constructor(
    protected readonly platform: VerisurePlatform,
    protected readonly accessory: PlatformAccessory<AccessoryContext>,
    protected readonly installation: VerisureInstallation
  ) {
    this.log = platform.log;
    this.hap = platform.api.hap;
    this.platformConfig = platform.config;
    this.serialNumber = accessory.context.deviceLabel;

    const { Characteristic, Service } = this.hap;
    this.accessoryInformation = this.accessory.getService(Service.AccessoryInformation)
      ?? this.accessory.addService(Service.AccessoryInformation);
    this.accessoryInformation
      .setCharacteristic(Characteristic.Manufacturer, 'Verisure')
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber ?? this.installation.giid);

    this.platform.poller(this.installation).subscribe((overview) => this.onOverview(overview));
  }

  /** Paints the accessory's current characteristics from an overview that
   * was already fetched for discovery, so it doesn't sit at HAP's default
   * value until the next poll tick fires. */
  paint(overview: Overview): void {
    this.onOverview(overview);
  }

  protected logPrefixed(message: string, level: 'info' | 'debug' | 'warn' | 'error' = 'info'): void {
    this.log[level](`${this.installation.config.alias} ${this.accessory.displayName}: ${message}`);
  }

  /** Called on every poll tick with a fresh overview. Implementations should
   * push any new values to their characteristics via `updateValue()` and
   * must not throw - a missing/malformed slice for this one device shouldn't
   * take down anything else. */
  protected abstract onOverview(overview: Overview): void;

  /** Polls a change-result query until Verisure resolves the transaction
   * (non-null result) or `CHANGE_RESULT_TIMEOUT_MS` elapses. The original
   * implementation had no timeout, so a transaction Verisure never resolved
   * would retry forever every 200ms. */
  protected async resolveChangeResult(
    operation: GraphqlOperation,
    deadline: number = Date.now() + CHANGE_RESULT_TIMEOUT_MS
  ): Promise<string> {
    this.logPrefixed(`Resolving: ${operation.operationName}`, 'debug');

    const { installation: { pollResult: { result } } } = await this.installation
      .client<{ installation: { pollResult: { result: string | null } } }>(operation);

    this.logPrefixed(`Got "${result}" back from: ${operation.operationName}`, 'debug');

    if (result !== null) {
      return result;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${operation.operationName} to resolve.`);
    }

    await new Promise((resolve) => { setTimeout(resolve, CHANGE_RESULT_POLL_INTERVAL_MS); });
    return this.resolveChangeResult(operation, deadline);
  }
}
