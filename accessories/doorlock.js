const VerisureAccessory = require('./verisure');

class DoorLock extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { doorcode, doorCode } = this.platformConfig;
    this.doorCode = doorcode || doorCode;
    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartLock (${this.config.deviceArea})`);
    this.value = this.resolveCurrentLockState(this.config);

    // TODO: Init polling for externally invoked state changes.
  }

  resolveCurrentLockState(doorLock) {
    const { LockCurrentState } = this.homebridge.hap.Characteristic;

    if (doorLock.motorJam) {
      return LockCurrentState.JAMMED;
    }

    return doorLock.currentLockState === 'LOCKED' ?
      LockCurrentState.SECURED : LockCurrentState.UNSECURED;
  }

  getDoorLockState() {
    const request = {
      uri: '/doorlockstate/search',
    };

    return this.installation.client(request)
      .then(doorLocks =>
        doorLocks.find(doorLock =>
          doorLock.deviceLabel === this.serialNumber))
      .then((doorLock) => {
        if (!doorLock) {
          throw Error(`Could not find lock state for ${this.name}.`);
        }
        return doorLock;
      });
  }

  getCurrentLockState(callback) {
    this.log('Getting current lock state.');

    this.getDoorLockState().then((doorLock) => {
      this.value = this.resolveCurrentLockState(doorLock);
      callback(null, this.value);
    }).catch(callback);
  }

  getTargetLockState(callback) {
    this.log('Getting target lock state.');

    this.getDoorLockState().then((doorLock) => {
      const { LockTargetState } = this.homebridge.hap.Characteristic;
      const { pendingLockState, currentLockState } = doorLock;

      const targetLockState = pendingLockState === 'NONE' ?
        currentLockState : pendingLockState;
      callback(null, targetLockState === 'LOCKED' ?
        LockTargetState.SECURED : LockTargetState.UNSECURED);
    }).catch(callback);
  }

  setTargetLockState(value, callback) {
    this.log(`Setting target lock state to: ${value}`);

    const request = {
      method: 'PUT',
      uri: `/device/${this.serialNumber}/${value ? 'lock' : 'unlock'}`,
      json: {
        code: this.doorCode,
      },
    };

    this.installation.client(request)
      .then(({ doorLockStateChangeTransactionId }) =>
        this.resolveChangeResult(`/doorlockstate/change/result/${doorLockStateChangeTransactionId}`))
      .catch((error) => {
        if (error.errorCode === 'VAL_00819') {
          // Lock at desired state.
          return true;
        }
        throw error;
      })
      .then(() => {
        this.service.setCharacteristic(this.homebridge.hap.Characteristic.LockCurrentState, value);
        this.value = value;
        callback(null);
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.LockMechanism(this.name);
    this.service
      .getCharacteristic(Characteristic.LockCurrentState)
      .on('get', this.getCurrentLockState.bind(this));
    this.service
      .getCharacteristic(Characteristic.LockTargetState)
      .on('get', this.getTargetLockState.bind(this))
      .on('set', this.setTargetLockState.bind(this));

    return [this.accessoryInformation, this.service];
  }
}

module.exports = DoorLock;
