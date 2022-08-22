const hap = require('hap-nodejs');

const DoorLock = require('./doorlock');

describe('DoorLock', () => {
  const homebridge = { hap };
  const logger = { info: jest.fn(), debug: jest.fn() };
  const config = {
    area: 'Entré',
    deviceLabel: '1234',
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
    installation.client = () => Promise.resolve([{
      currentLockState: 'LOCKED',
      deviceLabel: doorLock.serialNumber,
    }]);
    doorLock.getCurrentLockState((error, value) => {
      expect(error).toBeFalsy();
      expect(value).toBe(LockCurrentState.SECURED);
      done();
    });
  });

  it('errors when not able to get lock state', (done) => {
    expect.assertions(4);
    installation.client = () => Promise.resolve([{
      currentLockState: 'LOCKED',
      deviceLabel: 'NOT MATCHING LABEL',
    }]);
    const currentDoorLockValue = doorLock.value;
    doorLock.getCurrentLockState((error, value) => {
      expect(error).toBeTruthy();
      expect(error.message).toBe('Could not find lock state for SmartLock (Entré).');
      expect(value).toBeUndefined();
      expect(doorLock.value).toBe(currentDoorLockValue);
      done();
    });
  });

  it('gets target lock state', (done) => {
    expect.assertions(2);
    expect.assertions(2);
    installation.client = () => Promise.resolve([{
      currentLockState: 'UNLOCKED',
      deviceLabel: doorLock.serialNumber,
      pendingLockState: 'LOCKED',
    }]);
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
      doorLockStateChangeTransactionId: 'asd123',
    });
    installation.client.mockResolvedValueOnce({
      result: 'NO_DATA',
    });
    installation.client.mockResolvedValueOnce({
      result: 'OK',
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
    installation.client.mockRejectedValue({ errorCode: 'VAL_00819' });

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
    installation.client.mockRejectedValue({ errorCode: 'VAL_1337' });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error.errorCode).toBe('VAL_1337');
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
    installation.client.mockResolvedValueOnce({ autoLockEnabled: false });
    doorLock.getAutoLockState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(false);
      done();
    });
  });

  it('set switch state', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ autoLockEnabled: true });

    doorLock.setAutoLockState(true, (error) => {
      expect(doorLock.autoLockState).toBe(true);
      expect(error).toBeNull();
      done();
    });
  });

  it('resolves muted state from config', () => {
    const state = DoorLock.resolveMutedState({ volume: 'SILENCE' });
    expect(state).toBe(true);
  });

  it('resolves unmuted state from config', () => {
    const state = DoorLock.resolveMutedState({ volume: 'HIGH' });
    expect(state).toBe(false);
  });

  it('get current muted state', (done) => {
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ volume: 'SILENCE' });
    doorLock.getMuteState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(true);
      done();
    });
  });

  it('set muted state', (done) => {
    expect.assertions(2);
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({ volume: 'HIGH' });

    doorLock.setMuteState(false, (error) => {
      expect(doorLock.mutedState).toBe(false);
      expect(error).toBeNull();
      done();
    });
  });
});
