const hap = require('hap-nodejs');

const DoorLock = require('./doorlock');

describe('DoorLock', () => {
  const homebridge = { hap };
  const logger = jest.fn();
  const config = {
    area: 'Entré',
    deviceLabel: '1234',
  };
  const installation = {
    giid: 'abc123',
    client: null,
  };
  const platformConfig = {
    doorCode: '000000',
  };
  const { LockCurrentState, LockTargetState } = hap.Characteristic;
  const doorLock = new DoorLock(homebridge, logger, config, installation, platformConfig);

  doorLock.getServices();

  it('setup name, code and value', () => {
    expect(doorLock.name).toBe('SmartLock (Entré)');
    expect(doorLock.doorCode).toBe('000000');
    expect(doorLock.value).toBe(LockCurrentState.UNSECURED);
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

  it('gets and updates lock state', (done) => {
    expect.assertions(3);
    installation.client = () => Promise.resolve([{
      currentLockState: 'LOCKED',
      deviceLabel: doorLock.serialNumber,
    }]);
    doorLock.getCurrentLockState((error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(LockCurrentState.SECURED);
      expect(doorLock.value).toBe(LockCurrentState.SECURED);
      done();
    });
  });

  it('errors when not able to get lock state', (done) => {
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
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      doorLockStateChangeTransactionId: 'asd123',
    });
    installation.client.mockResolvedValueOnce({
      result: 'NO_DATA',
    });
    installation.client.mockResolvedValueOnce({
      result: 'SOMETHING_ELSE',
    });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error, value) => {
      expect(error).toBeNull();
      expect(value).toBe(LockTargetState.SECURED);
      const { calls } = installation.client.mock;
      expect(calls.length).toBe(3);
      done();
    });
  });

  it('sets target lock state to same as current state', (done) => {
    installation.client = jest.fn();
    installation.client.mockRejectedValue({ errorCode: 'VAL_00819' });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error).toBeNull();
      done();
    });
  });

  it('handles error when setting lock state', (done) => {
    installation.client = jest.fn();
    installation.client.mockRejectedValue({ errorCode: 'VAL_1337' });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error.errorCode).toBe('VAL_1337');
      done();
    });
  });
});
