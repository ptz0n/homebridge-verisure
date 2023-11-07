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

    const { area } = this.config.device;
    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartLock (${area})`);

    this.doorCode = this.platformConfig.doorCode;
    this.targetLockState = 'NONE';
    this.switchName = VerisureAccessory.getUniqueAccessoryName(`Auto-lock (${area})`);
    this.audioName = VerisureAccessory.getUniqueAccessoryName(`Audio (${area})`);

    // TODO: Could set currentLockState here.
  }

  resolveCurrentLockState({ currentLockState, motorJam }) {
    const { LockCurrentState } = this.homebridge.hap.Characteristic;

    if (motorJam) {
      return LockCurrentState.JAMMED;
    }

    return currentLockState === 'LOCKED'
      ? LockCurrentState.SECURED
      : LockCurrentState.UNSECURED;
  }

  getDoorLock() {
    this.log('Getting current lock state.', 'debug');

    return this.installation.client(overviewOperation)
      .then((overview) => overview.installation.doorlocks
        .find((doorlock) => doorlock.device.deviceLabel === this.serialNumber))
      .then((doorLock) => {
        if (!doorLock) {
          throw Error(`Could not find lock state for ${this.name}.`);
        }
        return doorLock;
      });
  }

  getCurrentLockState(callback) {
    // TODO: Use this.cachedValue, if available?

    this.getDoorLock().then((doorLock) => {
      callback(null, this.resolveCurrentLockState(doorLock));
    }).catch(callback);
  }

  getTargetLockState(callback) {
    this.log('Getting target lock state.');

    this.getDoorLock().then((doorLock) => {
      const { LockTargetState } = this.homebridge.hap.Characteristic;

      const { currentLockState } = doorLock;

      const targetLockState = this.targetLockState === 'NONE'
        ? currentLockState : this.targetLockState;

        callback(null, targetLockState === 'LOCKED'
        ? LockTargetState.SECURED
        : LockTargetState.UNSECURED);
    }).catch((error) => {
      callback(error);
    });
  }

  setTargetLockState(value, callback) {
    this.log(`Setting target lock state to: ${value}`);

    this.targetLockState = value === this.homebridge.hap.Characteristic.LockCurrentState.SECURED
      ? 'LOCKED'
      : 'UNLOCKED';

    const operation = this.targetLockState === 'LOCKED'
      ? doorLockOperation
      : doorUnlockOperation;

    this.installation.client(operation(this.serialNumber, this.doorCode))
      .then(({ transactionId }) => this.resolveChangeResult(
        pollLockStateOperation(transactionId, this.serialNumber, this.targetLockState),
      ))
      .catch((error) => {
        const isAlreadyAtTargetStateError = error.errors && error.errors
          .find(({ data: { errorCode } }) => errorCode === 'VAL_00819');
        if (isAlreadyAtTargetStateError) {
          this.targetLockState = 'NONE';
          return true; // Lock at desired state.
        }

        throw error;
      })
      .then(() => {
        this.targetLockState = 'NONE';
        callback(); // Successful action.

        setImmediate(() => {
          const { LockCurrentState } = this.homebridge.hap.Characteristic;
          this.lockService.setCharacteristic(LockCurrentState, value);
        });
        // TODO: Set this.cachedValue with TTL?
      })
      .catch(callback);
  }

  static resolveAutoLockState(config) {
    return config.autoLockEnabled === true;
  }

  getAutoLockState(callback) {
    this.log('Getting current auto lock config.');

    this.installation.client(doorLockConfigOperation(this.serialNumber))
      .then(({ installation: { smartLocks: [smartLock] } }) => {
        this.autoLockState = DoorLock.resolveAutoLockState(smartLock.configuration);
        callback(null, this.autoLockState);
      })
      .catch(callback);
  }

  setAutoLockState(value, callback) {
    this.log(`Setting auto lock to: ${value}`);

    this.autoLockState = value;

    this.installation.client(
      doorLockUpdateConfigOperation(this.serialNumber, { autoLockEnabled: value }),
    )
      .then(() => callback(null))
      .catch((error) => {
        this.log(error.message, 'debug');
        // TODO: Revert config state in this.value?
        callback({ message: error.errorMessage });
      });
  }

  getAudioState(callback) {
    this.log('Getting current audio config.');

    this.installation.client(doorLockConfigOperation(this.serialNumber))
      .then(({ installation: { smartLocks: [smartLock] } }) => {
        this.audioState = smartLock.configuration.volume !== this.platformConfig.audioOffValue;
        callback(null, this.audioState);
      })
      .catch(callback);
  }

  setAudioState(value, callback) {
    this.audioState = value;

    const volume = value
      ? this.platformConfig.audioOnValue
      : this.platformConfig.audioOffValue;

    this.log(`Setting audio volume to: ${volume}`);

    this.installation.client(
      doorLockUpdateConfigOperation(this.serialNumber, { volume }),
    )
      .then(() => callback(null))
      .catch((error) => {
        this.log(error.message, 'debug');
        // TODO: Revert config state in this.value?
        callback({ message: error.errorMessage });
      });
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    const services = [this.accessoryInformation];

    this.lockService = new Service.LockMechanism(this.name);
    const currentStateCharacteristic = this.lockService
      .getCharacteristic(Characteristic.LockCurrentState)
      .on('get', this.getCurrentLockState.bind(this));

    this.lockService
      .getCharacteristic(Characteristic.LockTargetState)
      .on('get', this.getTargetLockState.bind(this))
      .on('set', this.setTargetLockState.bind(this));

    services.push(this.lockService);

    if (this.platformConfig.showAutoLockSwitch) {
      this.autoLockService = new Service.Switch(this.switchName, this.switchName);
      this.autoLockService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getAutoLockState.bind(this))
        .on('set', this.setAutoLockState.bind(this));

      services.push(this.autoLockService);
    }

    if (this.platformConfig.showAudioSwitch) {
      this.audioService = new Service.Switch(this.audioName, this.audioName);
      this.audioService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getAudioState.bind(this))
        .on('set', this.setAudioState.bind(this));

      services.push(this.audioService);
    }

    this.pollCharacteristics.push(currentStateCharacteristic);

    return services;
  }
}

module.exports = DoorLock;
