const VerisureAccessory = require('./verisure');

class DoorLock extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartLock (${this.config.area})`);

    this.doorCode = this.platformConfig.doorCode;
    this.switchName = VerisureAccessory.getUniqueAccessoryName(`Auto-lock (${this.config.area})`);
    this.configUrl = `/device/${this.serialNumber}/doorlockconfig`;
  }

  resolveCurrentLockState(doorLock) {
    const { LockCurrentState } = this.homebridge.hap.Characteristic;

    if (doorLock.motorJam) {
      return LockCurrentState.JAMMED;
    }

    return doorLock.currentLockState === 'LOCKED'
      ? LockCurrentState.SECURED : LockCurrentState.UNSECURED;
  }

  getDoorLockState() {
    const request = {
      url: '/doorlockstate/search',
    };

    return this.installation.client(request)
      .then((doorLocks) => doorLocks.find((doorLock) => doorLock.deviceLabel === this.serialNumber))
      .then((doorLock) => {
        if (!doorLock) {
          throw Error(`Could not find lock state for ${this.name}.`);
        }
        return doorLock;
      });
  }

  getCurrentLockState(callback) {
    this.log('Getting current lock state.', 'debug');

    // TODO: Use this.cachedValue, if available?

    this.getDoorLockState().then((doorLock) => {
      callback(null, this.resolveCurrentLockState(doorLock));
    }).catch(callback);
  }

  getTargetLockState(callback) {
    this.log('Getting target lock state.');

    this.getDoorLockState().then((doorLock) => {
      const { LockTargetState } = this.homebridge.hap.Characteristic;
      const { pendingLockState, currentLockState } = doorLock;

      const targetLockState = pendingLockState === 'NONE'
        ? currentLockState : pendingLockState;
      callback(null, targetLockState === 'LOCKED'
        ? LockTargetState.SECURED : LockTargetState.UNSECURED);
    }).catch(callback);
  }

  setTargetLockState(value, callback) {
    this.log(`Setting target lock state to: ${value}`);

    const request = {
      method: 'PUT',
      url: `/device/${this.serialNumber}/${value ? 'lock' : 'unlock'}`,
      data: { code: this.doorCode },
    };

    this.installation.client(request)
      .then(({ doorLockStateChangeTransactionId }) => this.resolveChangeResult(`/doorlockstate/change/result/${doorLockStateChangeTransactionId}`))
      .catch((error) => {
        if (error.errorCode === 'VAL_00819') {
          return true; // Lock at desired state.
        }
        throw error;
      })
      .then(() => {
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

    this.installation.client({ url: this.configUrl })
      .then((config) => {
        this.autoLockState = DoorLock.resolveAutoLockState(config);
        callback(null, this.autoLockState);
      })
      .catch(callback);
  }

  setAutoLockState(value, callback) {
    this.log(`Setting auto lock to: ${value}`);

    this.autoLockState = value;

    const request = {
      method: 'PUT',
      url: this.configUrl,
      data: { autoLockEnabled: value },
    };

    this.installation.client(request)
      .then(() => callback(null))
      .catch((error) => {
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

    this.switchService = new Service.Switch(this.switchName);
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getAutoLockState.bind(this))
      .on('set', this.setAutoLockState.bind(this));

    services.push(this.switchService);

    this.pollCharacteristics.push(currentStateCharacteristic);

    return services;
  }
}

module.exports = DoorLock;
