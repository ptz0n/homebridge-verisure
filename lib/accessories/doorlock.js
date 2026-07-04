const VerisureAccessory = require('./verisure');
const {
  overviewOperation,
  doorLockOperation,
  doorUnlockOperation,
  pollLockStateOperation,
  doorLockConfigOperation,
  doorLockUpdateConfigOperation,
} = require('../operations');

class DoorLock extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const area = (this.config.device.area || '').trim();
    this.name = VerisureAccessory.getUniqueAccessoryName(area ? `SmartLock - ${area}` : 'SmartLock');

    this.doorCode = this.platformConfig.doorCode;
    this.switchName = VerisureAccessory.getUniqueAccessoryName(area ? `Auto-lock - ${area}` : 'Auto-lock');
    this.audioName = VerisureAccessory.getUniqueAccessoryName(area ? `Audio - ${area}` : 'Audio');

    // TODO: Could set currentLockState here.
  }

  resolveCurrentLockState({ currentLockState, motorJam }) {
    const { LockCurrentState } = this.homebridge.hap.Characteristic;

    if (motorJam) {
      return LockCurrentState.JAMMED;
    }

    return currentLockState === 'LOCKED' ? LockCurrentState.SECURED : LockCurrentState.UNSECURED;
  }

  async getDoorLockState() {
    this.log('Getting current lock state.', 'debug');

    const overview = await this.installation.client(overviewOperation);
    const doorLock = overview.installation.doorlocks.find(
      (dl) => dl.device.deviceLabel === this.serialNumber
    );

    if (!doorLock) {
      throw Error(`Could not find lock state for ${this.name}.`);
    }

    return doorLock;
  }

  async getCurrentLockState() {
    // TODO: Use this.cachedValue, if available?

    const doorLock = await this.getDoorLockState();
    return this.resolveCurrentLockState(doorLock);
  }

  async getTargetLockState() {
    this.log('Getting target lock state.');

    const { currentLockState } = await this.getDoorLockState();
    const { LockTargetState } = this.homebridge.hap.Characteristic;

    const targetLockState = this.targetLockState || currentLockState;

    return targetLockState === 'LOCKED' ? LockTargetState.SECURED : LockTargetState.UNSECURED;
  }

  async setTargetLockState(value) {
    this.log(`Setting target lock state to: ${value}`);

    this.targetLockState = value === this.homebridge.hap.Characteristic.LockCurrentState.SECURED ? 'LOCKED' : 'UNLOCKED';

    const operation = this.targetLockState === 'LOCKED' ? doorLockOperation : doorUnlockOperation;

    try {
      const { transactionId } = await this.installation.client(
        operation(this.serialNumber, this.doorCode)
      );
      await this.resolveChangeResult(
        pollLockStateOperation(transactionId, this.serialNumber, this.targetLockState)
      );
    } catch (error) {
      const isAlreadyAtTargetStateError = error.errors && error.errors.find(({ data: { errorCode } }) => errorCode === 'VAL_00819');
      if (!isAlreadyAtTargetStateError) {
        throw error;
      }
      // Lock at desired state, continue.
    }

    setImmediate(() => {
      const { LockCurrentState } = this.homebridge.hap.Characteristic;
      this.lockService.updateCharacteristic(LockCurrentState, value);
    });
    // TODO: Set this.cachedValue with TTL?
  }

  static resolveAutoLockState(config) {
    return config.autoLockEnabled === true;
  }

  async getAutoLockState() {
    this.log('Getting current auto lock config.');

    const {
      installation: {
        smartLocks: [smartLock],
      },
    } = await this.installation.client(doorLockConfigOperation(this.serialNumber));

    this.autoLockState = DoorLock.resolveAutoLockState(smartLock.configuration);
    return this.autoLockState;
  }

  async setAutoLockState(value) {
    this.log(`Setting auto lock to: ${value}`);

    this.autoLockState = value;

    try {
      await this.installation.client(
        doorLockUpdateConfigOperation(this.serialNumber, { autoLockEnabled: value })
      );
    } catch (error) {
      this.log(error.message, 'debug');
      // TODO: Revert config state in this.value?
      throw new Error(error.errorMessage);
    }
  }

  async getAudioState() {
    this.log('Getting current audio config.');

    const {
      installation: {
        smartLocks: [smartLock],
      },
    } = await this.installation.client(doorLockConfigOperation(this.serialNumber));

    this.audioState = smartLock.configuration.volume !== this.platformConfig.audioOffValue;
    return this.audioState;
  }

  async setAudioState(value) {
    this.audioState = value;

    const volume = value ? this.platformConfig.audioOnValue : this.platformConfig.audioOffValue;

    this.log(`Setting audio volume to: ${volume}`);

    try {
      await this.installation.client(doorLockUpdateConfigOperation(this.serialNumber, { volume }));
    } catch (error) {
      this.log(error.message, 'debug');
      // TODO: Revert config state in this.value?
      throw new Error(error.errorMessage);
    }
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    const services = [this.accessoryInformation];

    this.lockService = new Service.LockMechanism(this.name);
    const currentStateCharacteristic = this.lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .onGet(this.getCurrentLockState.bind(this));

    this.lockService
      .getCharacteristic(Characteristic.LockTargetState)
      .onGet(this.getTargetLockState.bind(this))
      .onSet(this.setTargetLockState.bind(this));

    services.push(this.lockService);

    if (this.platformConfig.showAutoLockSwitch) {
      this.autoLockService = new Service.Switch(this.switchName, this.switchName);
      this.autoLockService
        .getCharacteristic(Characteristic.On)
        .onGet(this.getAutoLockState.bind(this))
        .onSet(this.setAutoLockState.bind(this));

      services.push(this.autoLockService);
    }

    if (this.platformConfig.showAudioSwitch) {
      this.audioService = new Service.Switch(this.audioName, this.audioName);
      this.audioService
        .getCharacteristic(Characteristic.On)
        .onGet(this.getAudioState.bind(this))
        .onSet(this.setAudioState.bind(this));

      services.push(this.audioService);
    }

    this.pollCharacteristics.push({
      characteristic: currentStateCharacteristic,
      getter: this.getCurrentLockState.bind(this),
    });

    return services;
  }
}

module.exports = DoorLock;
