const hap = require('hap-nodejs');

const DoorLock = require('./doorlock');

describe('DoorLock', () => {
  const homebridge = { hap };
  const logger = { info: console.log, debug: console.debug };
  const config = {
    device: {
      area: 'Entré',
      deviceLabel: '1234',
    },
    currentLockState: 'LOCKED',
    motorJam: false,
  };
  const installation = {
    giid: 'abc123',
    client: null,
    config: {
      alias: 'Home',
    },
  };
  const platformConfig = {
    doorCode: '000000',
    showAutoLockSwitch: true,
    showAudioSwitch: true,
    audioOffValue: 'LOW',
    audioOnValue: 'HIGH',
  };
  const { LockCurrentState, LockTargetState } = hap.Characteristic;
  const doorLock = new DoorLock(homebridge, logger, config, installation, platformConfig);

  doorLock.getServices();

  it('setup names and code', () => {
    expect(doorLock.name).toBe('SmartLock (Entré)');

    expect(doorLock.switchName).toBe('Auto-lock (Entré)');
    expect(doorLock.doorCode).toBe('000000');
  });

  it('resolves jammed lock state', () => {
    const state = doorLock.resolveCurrentLockState({ motorJam: true });
    expect(state).toBe(LockCurrentState.JAMMED);
  });

  it('resolves secured lock state', () => {
    const state = doorLock.resolveCurrentLockState({ currentLockState: 'LOCKED' });
    expect(state).toBe(LockCurrentState.SECURED);
  });

  it('resolves jammed even if locked', () => {
    const state = doorLock.resolveCurrentLockState({
      currentLockState: 'LOCKED',
      motorJam: true,
    });
    expect(state).toBe(LockCurrentState.JAMMED);
  });

  it('gets lock state', (done) => {
    expect.assertions(2);
    installation.client = () => Promise.resolve({
      installation: {
        doorlocks: [{
          device: {
            deviceLabel: doorLock.serialNumber,
          },
          currentLockState: 'LOCKED',
        }],
      },
    });
    doorLock.getCurrentLockState((error, value) => {
      expect(error).toBeFalsy();
      expect(value).toBe(LockCurrentState.SECURED);
      done();
    });
  });

  it('errors when not able to get lock state', (done) => {
    expect.assertions(4);
    installation.client = () => Promise.resolve({
      installation: {
        doorlocks: [{
          device: { deviceLabel: 'NOT MATCHING LABEL' },
          currentLockState: 'LOCKED',
        }],
      },
    });
    const currentDoorLockValue = doorLock.value;
    doorLock.getCurrentLockState((error, value) => {
      expect(error).toBeTruthy();
      expect(error.message).toBe('Could not find lock state for SmartLock (Entré).');
      expect(value).toBeUndefined();
      expect(doorLock.value).toBe(currentDoorLockValue);
      done();
    });
  });

  it('get target lock state equal to current state when target is not changed', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        doorlocks: [{
          device: {
            deviceLabel: doorLock.serialNumber,
          },
          currentLockState: 'UNLOCKED',
        }],
      },
    });

    // Should use currentLockState from response.
    doorLock.targetLockState = 'NONE';

    doorLock.getTargetLockState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(LockTargetState.UNSECURED);
      done();
    });
  });

  it('get target lock state when target is changed', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        doorlocks: [{
          device: {
            deviceLabel: doorLock.serialNumber,
          },
          currentLockState: 'UNLOCKED',
        }],
      },
    });

    // Should overwride currentLockState from response.
    doorLock.targetLockState = 'LOCKED';

    doorLock.getTargetLockState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(LockTargetState.SECURED);
      done();
    });
  });

  it('sets target lock state', (done) => {
    expect.assertions(3);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      transactionId: 'asd123',
    });
    installation.client.mockResolvedValueOnce({
      installation: {
        pollResult: {
          result: null,
        },
      },
    });
    installation.client.mockResolvedValueOnce({
      installation: {
        pollResult: {
          result: 'OK',
        },
      },
    });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error).toBeFalsy();
      const { calls } = installation.client.mock;
      expect(calls.length).toBe(3);

      setTimeout(() => { // Wait for setImmediate
        expect(doorLock.lockService.getCharacteristic(LockCurrentState).value)
          .toBe(LockTargetState.SECURED);
        done();
      }, 100);
    });
  });

  it('sets target lock state to same as current state', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockRejectedValue({
      errors: [{
        data: {
          errorCode: 'VAL_00819',
        },
      }],
    });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error).toBeFalsy();

      setTimeout(() => { // Wait for setImmediate
        expect(doorLock.lockService.getCharacteristic(LockCurrentState).value)
          .toBe(LockTargetState.SECURED);
        done();
      }, 100);
    });
  });

  it('handles error when setting lock state', (done) => {
    expect.assertions(1);
    installation.client = jest.fn();
    installation.client.mockRejectedValue({
      errors: [{
        data: {
          errorCode: 'VAL_1337',
        },
      }],
    });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error.errors[0].data.errorCode).toBe('VAL_1337');
      done();
    });
  });

  it('resolves disabled auto lock state from config', () => {
    const state = DoorLock.resolveAutoLockState({ autoLockEnabled: false });
    expect(state).toBe(false);
  });

  it('resolves enabled auto lock state from config', () => {
    const state = DoorLock.resolveAutoLockState({ autoLockEnabled: true });
    expect(state).toBe(true);
  });

  it('get current auto lock disabled state', (done) => {
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        smartLocks: [{
          configuration: {
            autoLockEnabled: false,
          },
        }],
      },
    });
    doorLock.getAutoLockState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(false);
      done();
    });
  });

  it('set auto lock switch state', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ something: 'something' });

    doorLock.setAutoLockState(true, (error) => {
      expect(doorLock.autoLockState).toBe(true);
      expect(error).toBeNull();
      done();
    });
  });

  it('get current audio switch state', (done) => {
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      installation: {
        smartLocks: [{
          configuration: {
            volume: 'LOW',
          },
        }],
      },
    });
    doorLock.getAudioState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(false); // LOW
      done();
    });
  });

  it('set audio switch state on', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ something: 'something' });

    doorLock.setAudioState(true, (error) => {
      expect(doorLock.audioState).toBe(true); // HIGH
      expect(error).toBeNull();
      done();
    });
  });
});
