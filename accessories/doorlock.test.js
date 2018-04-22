const hap = require('hap-nodejs');

const DoorLock = require('./doorlock');

describe('DoorLock', () => {
  const homebridge = { hap };
  const config = {
    deviceArea: 'Entré',
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
  const doorLock = new DoorLock(homebridge, null, config, installation, platformConfig);

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
      expect(error).toBe(null);
      expect(value).toBe(LockCurrentState.SECURED);
      expect(doorLock.value).toBe(LockCurrentState.SECURED);
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
      expect(error).toBe(null);
      expect(value).toBe(LockTargetState.SECURED);
      done();
    });
  });

  it('get lock state change result', () => {
    installation.client = jest.fn();
    installation.client.mockResolvedValueOnce({
      result: 'NO_DATA',
    });
    installation.client.mockResolvedValueOnce({
      result: 'READY',
    });

    const setLockStateResponse = {
      doorLockStateChangeTransactionId: 'asd123',
    };

    return doorLock.getLockStateChangeResult(setLockStateResponse).then((result) => {
      expect(result).toBe(true);
      const { calls } = installation.client.mock;
      expect(calls[0][0].uri).toBe('/doorlockstate/change/result/asd123');
      expect(calls[1][0].uri).toBe('/doorlockstate/change/result/asd123');
      expect(calls.length).toBe(2);
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

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error).toBe(null);
      const { calls } = installation.client.mock;
      expect(calls.length).toBe(3);
      done();
    });
  });

  it('sets target lock state to same as current state', (done) => {
    installation.client = jest.fn();
    installation.client.mockRejectedValue({ errorCode: 'VAL_00819' });

    doorLock.setTargetLockState(LockTargetState.SECURED, (error) => {
      expect(error).toBe(null);
      done();
    });
  });
});
