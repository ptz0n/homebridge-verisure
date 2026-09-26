import type { PlatformConfig } from 'homebridge';

export interface VerisurePlatformConfig extends PlatformConfig {
  email?: string;
  password?: string;
  cookies?: string[];
  alarmCode?: string;
  doorCode?: string;
  /** @deprecated use doorCode */
  doorcode?: string;
  installations?: string[];
  pollInterval?: number;
  showAutoLockSwitch?: boolean;
  showAudioSwitch?: boolean;
  audioOffValue?: 'SILENCE' | 'LOW';
  audioOnValue?: 'LOW' | 'HIGH';
  /** Passed to Verisure's armAway/armHome mutations to bypass the "open
   * door/window" guard. Without this, arming can silently fail (or reject)
   * whenever a sensor isn't in its expected state - see issue #56. */
  forceArm?: boolean;
  /** Accessory types to never expose, e.g. ["climateSensor", "contactSensor"]. */
  excludedAccessoryTypes?: AccessoryType[];
  /** Device labels, or free-text area names, to never expose regardless of type. */
  excludedDevices?: string[];
  /** @deprecated replaced by cookies */
  token?: string;
}

export type AccessoryType = 'alarm' | 'climateSensor' | 'contactSensor' | 'doorLock' | 'smartPlug';

export interface Device {
  deviceLabel: string;
  area?: string;
  gui?: {
    label?: string;
    support?: string;
  };
}

export interface ArmState {
  type?: string;
  statusType: string;
  date?: string;
  name?: string;
  changedVia?: string;
}

export interface Climate {
  device: Device;
  humidityEnabled?: boolean;
  humidityTimestamp?: string;
  humidityValue?: number;
  temperatureTimestamp?: string;
  temperatureValue?: number;
}

export interface DoorWindow {
  device: Device;
  type?: string;
  state: string;
  wired?: boolean;
  reportTime?: string;
}

export interface SmartPlugDevice {
  device: Device;
  currentState: string;
  icon?: string;
  isHazardous?: boolean;
}

export interface DoorLockDevice {
  device: Device;
  currentLockState: string;
  motorJam?: boolean;
}

export interface DoorLockConfiguration {
  autoLockEnabled?: boolean;
  voiceLevel?: string;
  volume?: string;
  /** Present instead of the above on non-Yale locks (e.g. DanaLock). */
  holdBackLatchDuration?: number;
  twistAssistEnabled?: boolean;
}

export interface SmartLockConfigEntry {
  device: Device;
  configuration: DoorLockConfiguration;
}

/** Everything a poll tick can learn about an installation. Every field is
 * nullable/absent-tolerant: Verisure's GraphQL API can - and for some
 * installation types (e.g. certain PreSense systems) reliably does - return
 * `null` for fields this plugin doesn't use, which previously crashed the
 * whole overview fetch (see issues #188, #189). */
export interface Overview {
  armState?: ArmState | null;
  climates?: Climate[] | null;
  doorWindows?: DoorWindow[] | null;
  smartplugs?: SmartPlugDevice[] | null;
  doorlocks?: DoorLockDevice[] | null;
}

export interface PollResult {
  result: string | null;
  createTime?: string;
}

/** Duck-typed shape of errors thrown by the `verisure` transport package. */
export interface VerisureError extends Error {
  errors?: Array<{ message?: string; data?: { errorCode?: string; status?: number } }>;
  isRateLimited?: boolean;
  response?: { status?: number; data?: unknown };
}

export const isVerisureError = (error: unknown): error is VerisureError => error instanceof Error;

export const isGraphqlException = (error: unknown): error is VerisureError => isVerisureError(error) && error.name === 'GraphqlException';

export const isRateLimited = (error: unknown): boolean => isVerisureError(error) && error.isRateLimited === true;

export const isUnauthorized = (error: unknown): boolean => isVerisureError(error) && error.response?.status === 401;
