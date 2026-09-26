import * as hap from '@homebridge/hap-nodejs';

import { makeAccessory, makeInstallation, makePlatform } from '../test/helpers';
import { DoorLock } from './doorLock';

const { LockCurrentState, LockTargetState, On } = hap.Characteristic;

describe('DoorLock', () => {
  const platform = makePlatform({ doorCode: '000000' });

  it('exposes lock, auto-lock and audio services by default', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('1234', 'SmartLock - Entré');
    new DoorLock(platform, accessory, installation);

    expect(accessory.getService(hap.Service.LockMechanism)).toBeDefined();
    expect(accessory.getServiceById(hap.Service.Switch, 'auto-lock')).toBeDefined();
    expect(accessory.getServiceById(hap.Service.Switch, 'audio')).toBeDefined();
  });

  it('omits the auto-lock/audio switches when disabled in config', () => {
    const noSwitches = makePlatform({ doorCode: '000000', showAutoLockSwitch: false, showAudioSwitch: false });
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('1234', 'SmartLock');
    new DoorLock(noSwitches, accessory, installation);

    expect(accessory.getServiceById(hap.Service.Switch, 'auto-lock')).toBeUndefined();
    expect(accessory.getServiceById(hap.Service.Switch, 'audio')).toBeUndefined();
  });

  it('resolves jammed over locked', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('1234');
    const lock = new DoorLock(platform, accessory, installation);
    lock.paint({ doorlocks: [{ device: { deviceLabel: '1234' }, currentLockState: 'LOCKED', motorJam: true }] });

    expect(
      accessory.getService(hap.Service.LockMechanism)!.getCharacteristic(LockCurrentState).value
    ).toBe(LockCurrentState.JAMMED);
  });

  it('gets the current lock state from the overview', async () => {
    const client = jest.fn().mockResolvedValue({
      installation: { doorlocks: [{ device: { deviceLabel: '1234' }, currentLockState: 'LOCKED' }] },
    });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    const value = await accessory.getService(hap.Service.LockMechanism)!
      .getCharacteristic(LockCurrentState).handleGetRequest();
    expect(value).toBe(LockCurrentState.SECURED);
  });

  it('sets the target lock state and reflects it back once resolved', async () => {
    const client = jest.fn()
      .mockResolvedValueOnce({ transactionId: 'asd123' })
      .mockResolvedValueOnce({ installation: { pollResult: { result: 'OK' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    await accessory.getService(hap.Service.LockMechanism)!
      .getCharacteristic(LockTargetState).handleSetRequest(LockTargetState.SECURED);

    expect(client.mock.calls[0][0].operationName).toBe('DoorLock');
    expect(client.mock.calls[0][0].variables).toMatchObject({ deviceLabel: '1234', input: { code: '000000' } });

    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(
      accessory.getService(hap.Service.LockMechanism)!.getCharacteristic(LockCurrentState).value
    ).toBe(LockTargetState.SECURED);
  });

  it('does not let a stale cached overview undo the confirmation read after unlocking - regression test for the Home app spinner never clearing', async () => {
    const client = jest.fn();
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);
    const lockService = accessory.getService(hap.Service.LockMechanism)!;

    // Prime the overview cache with the still-locked state.
    client.mockResolvedValueOnce({
      installation: { doorlocks: [{ device: { deviceLabel: '1234' }, currentLockState: 'LOCKED' }] },
    });
    await lockService.getCharacteristic(LockCurrentState).handleGetRequest();

    client
      .mockResolvedValueOnce({ transactionId: 'asd123' })
      .mockResolvedValueOnce({ installation: { pollResult: { result: 'OK' } } })
      // What a fresh fetch after invalidation should see.
      .mockResolvedValueOnce({
        installation: { doorlocks: [{ device: { deviceLabel: '1234' }, currentLockState: 'UNLOCKED' }] },
      });
    await lockService.getCharacteristic(LockTargetState).handleSetRequest(LockTargetState.UNSECURED);

    const value = await lockService.getCharacteristic(LockCurrentState).handleGetRequest();
    expect(value).toBe(LockCurrentState.UNSECURED);
    expect(client).toHaveBeenCalledTimes(4);
  });

  it('treats "already at target state" as success, not an error', async () => {
    const client = jest.fn().mockRejectedValue({ errors: [{ data: { errorCode: 'VAL_00819' } }] });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    await expect(
      accessory.getService(hap.Service.LockMechanism)!
        .getCharacteristic(LockTargetState).handleSetRequest(LockTargetState.SECURED)
    ).resolves.toBeUndefined();
  });

  it('propagates any other error from setting the lock state', async () => {
    const client = jest.fn().mockRejectedValue({ errors: [{ data: { errorCode: 'VAL_1337' } }] });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    await expect(
      accessory.getService(hap.Service.LockMechanism)!
        .getCharacteristic(LockTargetState).handleSetRequest(LockTargetState.SECURED)
    ).rejects.toBeDefined();
  });

  it('stops reporting a stale target state once the change settles - regression test for the reconcile loop in #159/#173/#181', async () => {
    const client = jest.fn()
      .mockResolvedValueOnce({ transactionId: 'asd123' })
      .mockResolvedValueOnce({ installation: { pollResult: { result: 'OK' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    const lock = new DoorLock(platform, accessory, installation);
    const lockService = accessory.getService(hap.Service.LockMechanism)!;

    await lockService.getCharacteristic(LockTargetState).handleSetRequest(LockTargetState.SECURED);

    // The lock is later unlocked by a physical key, not through HomeKit.
    // Getting the target state now must reflect that, instead of forever
    // echoing back the old "SECURED" target from the set above.
    client.mockResolvedValueOnce({
      installation: { doorlocks: [{ device: { deviceLabel: '1234' }, currentLockState: 'UNLOCKED' }] },
    });
    const targetValue = await lockService.getCharacteristic(LockTargetState).handleGetRequest();
    expect(targetValue).toBe(LockTargetState.UNSECURED);

    // A poll tick should also stop clamping the target state once settled.
    lock.paint({ doorlocks: [{ device: { deviceLabel: '1234' }, currentLockState: 'UNLOCKED' }] });
    expect(lockService.getCharacteristic(LockTargetState).value).toBe(LockTargetState.UNSECURED);
  });

  it('gets and sets the auto-lock switch via the (shared, cached) lock configuration query', async () => {
    const client = jest.fn().mockResolvedValue({
      installation: { smartLocks: [{ configuration: { autoLockEnabled: true } }] },
    });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    const autoLock = accessory.getServiceById(hap.Service.Switch, 'auto-lock')!;
    const value = await autoLock.getCharacteristic(On).handleGetRequest();
    expect(value).toBe(true);
  });

  it('caches the lock configuration query so auto-lock and audio share one request', async () => {
    const client = jest.fn().mockResolvedValue({
      installation: { smartLocks: [{ configuration: { autoLockEnabled: false, volume: 'LOW' } }] },
    });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    const autoLock = accessory.getServiceById(hap.Service.Switch, 'auto-lock')!;
    const audio = accessory.getServiceById(hap.Service.Switch, 'audio')!;

    await autoLock.getCharacteristic(On).handleGetRequest();
    await audio.getCharacteristic(On).handleGetRequest();

    expect(client).toHaveBeenCalledTimes(1);
  });

  it('reports a communication failure instead of crashing for a non-Yale lock with no volume field', async () => {
    const client = jest.fn().mockResolvedValue({
      installation: { smartLocks: [{ configuration: { holdBackLatchDuration: 2 } }] },
    });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    const audio = accessory.getServiceById(hap.Service.Switch, 'audio')!;
    await expect(audio.getCharacteristic(On).handleGetRequest()).rejects.toBeDefined();
  });

  it('sets the audio volume switch', async () => {
    const client = jest.fn().mockResolvedValue({ ok: true });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('1234');
    new DoorLock(platform, accessory, installation);

    const audio = accessory.getServiceById(hap.Service.Switch, 'audio')!;
    await audio.getCharacteristic(On).handleSetRequest(true);

    expect(client.mock.calls[0][0].variables).toMatchObject({ input: { volume: 'HIGH' } });
  });
});
