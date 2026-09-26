import * as hap from '@homebridge/hap-nodejs';

import { makeAccessory, makeInstallation, makePlatform } from '../test/helpers';
import { Alarm } from './alarm';

const { SecuritySystemCurrentState, SecuritySystemTargetState } = hap.Characteristic;

describe('Alarm', () => {
  const platform = makePlatform({ alarmCode: '000000' });

  it('exposes a SecuritySystem service and reads current state from the overview', async () => {
    const client = jest.fn().mockResolvedValue({ installation: { armState: { statusType: 'ARMED_AWAY' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    // eslint-disable-next-line no-new
    new Alarm(platform, accessory, installation);

    const service = accessory.getService(hap.Service.SecuritySystem)!;
    const value = await service.getCharacteristic(SecuritySystemCurrentState).handleGetRequest();
    expect(value).toBe(SecuritySystemCurrentState.AWAY_ARM);
  });

  it('sets the target arm state and reflects it back once resolved', async () => {
    const client = jest.fn()
      .mockResolvedValueOnce({ transactionId: 'asd123' })
      .mockResolvedValueOnce({ installation: { pollResult: { result: 'OK' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    // eslint-disable-next-line no-new
    new Alarm(platform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    await service.getCharacteristic(SecuritySystemTargetState).handleSetRequest(SecuritySystemCurrentState.AWAY_ARM);

    const [, armOperation] = client.mock.calls[0];
    expect(client.mock.calls[0][0].operationName).toBe('armAway');
    expect(client.mock.calls[0][0].variables).toMatchObject({ code: '000000', forceArm: true });
    void armOperation;

    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(service.getCharacteristic(SecuritySystemCurrentState).value).toBe(SecuritySystemCurrentState.AWAY_ARM);
  });

  it('passes forceArm: false through when configured', async () => {
    const client = jest.fn()
      .mockResolvedValueOnce({ transactionId: 'asd123' })
      .mockResolvedValueOnce({ installation: { pollResult: { result: 'OK' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    const noForcePlatform = makePlatform({ alarmCode: '000000', forceArm: false });
    // eslint-disable-next-line no-new
    new Alarm(noForcePlatform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    await service.getCharacteristic(SecuritySystemTargetState).handleSetRequest(SecuritySystemCurrentState.STAY_ARM);

    expect(client.mock.calls[0][0].variables).toMatchObject({ forceArm: false });
  });

  it('rejects an unrecognized target state (e.g. Night, sent by a 3rd-party HomeKit client) instead of crashing', async () => {
    const client = jest.fn();
    const installation = makeInstallation(client);
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    // eslint-disable-next-line no-new
    new Alarm(platform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    await expect(
      service.getCharacteristic(SecuritySystemTargetState).handleSetRequest(SecuritySystemTargetState.NIGHT_ARM)
    ).rejects.toBeDefined();
    expect(client).not.toHaveBeenCalled();
  });

  it('does not offer Night as a valid target state', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    // eslint-disable-next-line no-new
    new Alarm(platform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    const validValues = service.getCharacteristic(SecuritySystemTargetState).props.validValues;
    expect(validValues).not.toContain(SecuritySystemTargetState.NIGHT_ARM);
  });

  it('updates the current state characteristic on a poll tick', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    const alarm = new Alarm(platform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    alarm.paint({ armState: { statusType: 'ARMED_HOME' } });

    expect(service.getCharacteristic(SecuritySystemCurrentState).value).toBe(SecuritySystemCurrentState.STAY_ARM);
  });

  it('falls back to the last known state for a transitional status like CHANGE_IN_PROGRESS - regression test for a live crash', async () => {
    const client = jest.fn().mockResolvedValue({ installation: { armState: { statusType: 'CHANGE_IN_PROGRESS' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    const alarm = new Alarm(platform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    // Establish a known state first, via a poll tick.
    alarm.paint({ armState: { statusType: 'DISARMED' } });
    expect(service.getCharacteristic(SecuritySystemCurrentState).value).toBe(SecuritySystemCurrentState.DISARMED);

    // A read landing mid-transition must not error or clobber that state.
    const value = await service.getCharacteristic(SecuritySystemCurrentState).handleGetRequest();
    expect(value).toBe(SecuritySystemCurrentState.DISARMED);

    // Nor should a poll tick landing mid-transition.
    alarm.paint({ armState: { statusType: 'CHANGE_IN_PROGRESS' } });
    expect(service.getCharacteristic(SecuritySystemCurrentState).value).toBe(SecuritySystemCurrentState.DISARMED);
  });

  it('reports a communication failure for an unrecognized status with no prior known state', async () => {
    const client = jest.fn().mockResolvedValue({ installation: { armState: { statusType: 'CHANGE_IN_PROGRESS' } } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory(undefined, 'Alarm - Kungsgatan');
    new Alarm(platform, accessory, installation);
    const service = accessory.getService(hap.Service.SecuritySystem)!;

    await expect(service.getCharacteristic(SecuritySystemCurrentState).handleGetRequest()).rejects.toBeDefined();
  });
});
