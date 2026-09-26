import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory } from 'homebridge';
import Verisure, { VerisureInstallation } from 'verisure';

import { Alarm } from './accessories/alarm';
import type { AccessoryContext } from './accessories/base';
import { ClimateSensor } from './accessories/climateSensor';
import { ContactSensor } from './accessories/contactSensor';
import type { VerisureAccessoryHandler } from './accessories/base';
import { DoorLock } from './accessories/doorLock';
import { SmartPlug } from './accessories/smartPlug';
import { CLIMATE_DEVICE_NAMES } from './deviceNames';
import { i18n } from './i18n';
import { OverviewPoller } from './overviewPoller';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import type { AccessoryType, Climate, Overview, SmartPlugDevice, VerisurePlatformConfig } from './types';
import { isUnauthorized } from './types';

interface DiscoveredDevice {
  type: AccessoryType;
  deviceLabel?: string;
  displayName: string;
  initial?: Climate | SmartPlugDevice;
}

export class VerisurePlatform implements DynamicPlatformPlugin {
  public readonly config: VerisurePlatformConfig;

  private readonly verisure: Verisure;

  private readonly accessories = new Map<string, PlatformAccessory<AccessoryContext>>();

  private readonly handlers = new Map<string, VerisureAccessoryHandler>();

  private readonly pollers = new Map<string, OverviewPoller>();

  constructor(
    public readonly log: Logger,
    config: VerisurePlatformConfig,
    public readonly api: API
  ) {
    const {
      VERISURE_ALARM_CODE,
      VERISURE_DOOR_CODE,
      VERISURE_EMAIL,
      VERISURE_PASSWORD,
      VERISURE_COOKIES,
      VERISURE_TOKEN, // Deprecated.
    } = process.env;

    this.config = {
      ...config,
      alarmCode: VERISURE_ALARM_CODE || config.alarmCode,
      doorCode: VERISURE_DOOR_CODE || config.doorcode || config.doorCode,
      email: VERISURE_EMAIL || config.email,
      password: VERISURE_PASSWORD || config.password,
      cookies: (VERISURE_COOKIES && VERISURE_COOKIES.split(';')) || config.cookies,
      installations: config.installations ?? [],
      pollInterval: config.pollInterval ?? 60,
      showAutoLockSwitch: config.showAutoLockSwitch ?? true,
      showAudioSwitch: config.showAudioSwitch ?? true,
      audioOffValue: config.audioOffValue ?? 'LOW',
      audioOnValue: config.audioOnValue ?? 'HIGH',
      forceArm: config.forceArm ?? true,
      excludedAccessoryTypes: config.excludedAccessoryTypes ?? [],
      excludedDevices: config.excludedDevices ?? [],
    };

    if (VERISURE_TOKEN || config.token) {
      this.log.error('DEPRECATED: Property "token" in config. Please see README to get and configure "cookies".');
    }

    this.verisure = new Verisure(this.config.email, this.config.password, this.config.cookies);

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices().catch((error) => {
        this.log.error(`Unexpected error while discovering devices: ${(error as Error).message}`);
      });
    });

    this.api.on('shutdown', () => {
      this.pollers.forEach((poller) => poller.stop());
    });
  }

  /** Called by Homebridge once at startup for every accessory it restored
   * from its cache, before `didFinishLaunching`/discovery runs. */
  configureAccessory(accessory: PlatformAccessory): void {
    this.accessories.set(accessory.UUID, accessory as PlatformAccessory<AccessoryContext>);
  }

  /** Shared per-installation overview fetcher/poller, used by both this
   * class and every accessory handler. */
  poller(installation: VerisureInstallation): OverviewPoller {
    let poller = this.pollers.get(installation.giid);
    if (!poller) {
      poller = new OverviewPoller(installation, this.log, (this.config.pollInterval as number) * 1000);
      this.pollers.set(installation.giid, poller);
    }
    return poller;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.verisure.cookies.length) {
      return;
    }
    await this.verisure.getToken();
    if (!this.verisure.getCookie('vid')) {
      throw new Error('MFA is enabled for this account. Please see the README, and run "npx homebridge-verisure@latest" to generate "cookies".');
    }
  }

  private async discoverDevices(): Promise<void> {
    try {
      await this.ensureAuthenticated();
    } catch (error) {
      if (isUnauthorized(error)) {
        this.log.error('Verisure rejected the configured email/password (401). Please check your credentials, or use "cookies" instead if MFA is enabled - see the README.');
      } else {
        this.log.error((error as Error).message);
      }
      return;
    }

    let installations: VerisureInstallation[];
    try {
      const configuredAliases = this.config.installations ?? [];
      installations = (await this.verisure.getInstallations())
        .filter((installation) => configuredAliases.length === 0 || configuredAliases.includes(installation.config.alias));
    } catch (error) {
      if (isUnauthorized(error)) {
        this.log.error('Verisure rejected our credentials (401). If you use "cookies" for MFA, they\'ve likely expired - run "npx homebridge-verisure@latest" to get fresh ones.');
      } else {
        this.log.error(`Unable to get installations. Please check configured credentials: ${(error as Error).message}`);
      }
      return;
    }

    if (installations.length === 0) {
      this.log.error(`No installations found matching config: ${JSON.stringify(this.config.installations)}`);
      return;
    }

    await Promise.all(installations.map((installation) => this.discoverInstallation(installation)));
    this.retireUnusedPollers(installations);
  }

  private retireUnusedPollers(installations: VerisureInstallation[]): void {
    const activeGiids = new Set(installations.map((installation) => installation.giid));
    for (const [giid, poller] of this.pollers) {
      if (!activeGiids.has(giid)) {
        poller.stop();
        this.pollers.delete(giid);
      }
    }
  }

  private async discoverInstallation(installation: VerisureInstallation): Promise<void> {
    const poller = this.poller(installation);

    let overview: Overview;
    try {
      overview = await poller.getOverview();
    } catch (error) {
      this.log.error(`${installation.config.alias}: Unable to fetch the device list (${(error as Error).message}). Keeping any previously discovered accessories for this installation as-is.`);
      return;
    }

    const devices = this.buildDeviceList(installation, overview);
    const seenUUIDs = new Set<string>();
    const newAccessories: PlatformAccessory<AccessoryContext>[] = [];

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${installation.giid}:${device.type}:${device.deviceLabel ?? 'alarm'}`);
      seenUUIDs.add(uuid);

      let accessory = this.accessories.get(uuid);
      const isNew = !accessory;
      if (!accessory) {
        accessory = new this.api.platformAccessory<AccessoryContext>(device.displayName, uuid);
      }
      accessory.context = {
        deviceType: device.type,
        deviceLabel: device.deviceLabel,
        installationGiid: installation.giid,
      };

      const handler = this.instantiateHandler(device, accessory, installation);
      handler.paint(overview);

      this.accessories.set(uuid, accessory);
      this.handlers.set(uuid, handler);
      if (isNew) {
        newAccessories.push(accessory);
      }
    }

    if (newAccessories.length > 0) {
      this.log.info(`${installation.config.alias}: Registering ${newAccessories.length} new accessorie(s).`);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);
    }

    const staleAccessories = [...this.accessories.entries()]
      .filter(([uuid, accessory]) => accessory.context.installationGiid === installation.giid && !seenUUIDs.has(uuid))
      .map(([uuid, accessory]) => {
        this.accessories.delete(uuid);
        this.handlers.delete(uuid);
        return accessory;
      });

    if (staleAccessories.length > 0) {
      this.log.info(`${installation.config.alias}: Removing ${staleAccessories.length} accessorie(s) no longer present on this installation.`);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, staleAccessories);
    }

    poller.start();
  }

  private instantiateHandler(
    device: DiscoveredDevice,
    accessory: PlatformAccessory<AccessoryContext>,
    installation: VerisureInstallation
  ): VerisureAccessoryHandler {
    switch (device.type) {
      case 'alarm':
        return new Alarm(this, accessory, installation);
      case 'climateSensor':
        return new ClimateSensor(this, accessory, installation, device.initial as Climate);
      case 'contactSensor':
        return new ContactSensor(this, accessory, installation);
      case 'doorLock':
        return new DoorLock(this, accessory, installation);
      case 'smartPlug':
        return new SmartPlug(this, accessory, installation, device.initial as SmartPlugDevice);
      default:
        throw new Error(`Unknown accessory type: ${device.type satisfies never}`);
    }
  }

  private isExcluded(type: AccessoryType, deviceLabel?: string, area?: string): boolean {
    const excludedTypes = this.config.excludedAccessoryTypes ?? [];
    if (excludedTypes.includes(type)) {
      return true;
    }
    const excludedDevices = (this.config.excludedDevices ?? []).map((entry) => entry.trim().toLowerCase());
    return excludedDevices.includes((deviceLabel ?? '').toLowerCase())
      || excludedDevices.includes((area ?? '').trim().toLowerCase());
  }

  private buildDeviceList(installation: VerisureInstallation, overview: Overview): DiscoveredDevice[] {
    const devices: DiscoveredDevice[] = [];
    const translate = i18n(installation.locale);

    if (overview.armState && this.config.alarmCode && !this.isExcluded('alarm')) {
      devices.push({
        type: 'alarm',
        displayName: `Alarm - ${installation.config.alias}`,
      });
    }

    (overview.climates ?? []).forEach((climate) => {
      const { deviceLabel, area, gui } = climate.device;
      if (this.isExcluded('climateSensor', deviceLabel, area)) {
        return;
      }
      const label = gui?.label ?? 'UNKNOWN';
      const name = translate(CLIMATE_DEVICE_NAMES[label]) ?? label;
      const areaName = (area ?? '').trim();
      devices.push({
        type: 'climateSensor',
        deviceLabel,
        displayName: areaName ? `${name} - ${areaName}` : name,
        initial: climate,
      });
    });

    (overview.doorWindows ?? []).forEach((doorWindow) => {
      const { deviceLabel, area } = doorWindow.device;
      if (this.isExcluded('contactSensor', deviceLabel, area)) {
        return;
      }
      const areaName = (area ?? '').trim();
      devices.push({
        type: 'contactSensor',
        deviceLabel,
        displayName: areaName || 'Contact sensor',
      });
    });

    (overview.smartplugs ?? []).forEach((smartplug) => {
      const { deviceLabel, area } = smartplug.device;
      if (this.isExcluded('smartPlug', deviceLabel, area)) {
        return;
      }
      const areaName = (area ?? '').trim();
      devices.push({
        type: 'smartPlug',
        deviceLabel,
        displayName: areaName ? `SmartPlug - ${areaName}` : 'SmartPlug',
        initial: smartplug,
      });
    });

    if (this.config.doorCode) {
      (overview.doorlocks ?? []).forEach((doorlock) => {
        const { deviceLabel, area } = doorlock.device;
        if (this.isExcluded('doorLock', deviceLabel, area)) {
          return;
        }
        const areaName = (area ?? '').trim();
        devices.push({
          type: 'doorLock',
          deviceLabel,
          displayName: areaName ? `SmartLock - ${areaName}` : 'SmartLock',
        });
      });
    }

    return devices;
  }
}
