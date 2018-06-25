const VerisureAccessory = require('./verisure');

class DoorLock extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    this.doorCode = this.platformConfig.doorCode;
    this.name = VerisureAccessory.getUniqueAccessoryName(`SmartLock (${this.config.area})`);
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
      uri: '/doorlockstate/search',
    };

    return this.installation.client(request)
      .then(doorLocks => doorLocks.find(doorLock => doorLock.deviceLabel === this.serialNumber))
      .then((doorLock) => {
        if (!doorLock) {
          throw Error(`Could not find lock state for ${this.name}.`);
        }
        return doorLock;
      });
  }

  getCurrentLockState(callback) {
    this.log('Getting current lock state.');

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
      uri: `/device/${this.serialNumber}/${value ? 'lock' : 'unlock'}`,
      json: { code: this.doorCode },
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
          this.service.setCharacteristic(LockCurrentState, value);
        });
        // TODO: Set this.cachedValue with TTL?
      })
      .catch(callback);
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.LockMechanism(this.name);
    const currentStateCharacteristic = this.service
      .getCharacteristic(Characteristic.LockCurrentState)
      .on('get', this.getCurrentLockState.bind(this));

    this.service
      .getCharacteristic(Characteristic.LockTargetState)
      .on('get', this.getTargetLockState.bind(this))
      .on('set', this.setTargetLockState.bind(this));

    this.pollCharacteristics.push(currentStateCharacteristic);

    return [this.accessoryInformation, this.service];
  }
}

module.exports = DoorLock;
