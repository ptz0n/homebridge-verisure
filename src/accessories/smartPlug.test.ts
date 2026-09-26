import * as hap from '@homebridge/hap-nodejs';

import { makeAccessory, makeInstallation, makePlatform } from '../test/helpers';
import type { SmartPlugDevice } from '../types';
import { SmartPlug } from './smartPlug';

const initial: SmartPlugDevice = {
  device: { deviceLabel: 'ASD 123', area: 'Living room' },
  currentState: 'ON',
};

describe('SmartPlug', () => {
  const platform = makePlatform();

  it('reflects the initial state at construction', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('ASD 123', 'SmartPlug - Living room');
    new SmartPlug(platform, accessory, installation, initial);

    expect(accessory.getService(hap.Service.Switch)!.getCharacteristic(hap.Characteristic.On).value).toBe(true);
  });

  it('gets the current switch state from the overview', async () => {
    const client = jest.fn().mockResolvedValue({
      installation: { smartplugs: [{ device: { deviceLabel: 'ASD 123' }, currentState: 'OFF' }] },
    });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('ASD 123', 'SmartPlug - Living room');
    new SmartPlug(platform, accessory, installation, initial);

    const value = await accessory.getService(hap.Service.Switch)!
      .getCharacteristic(hap.Characteristic.On).handleGetRequest();
    expect(value).toBe(false);
  });

  it('sets the switch state', async () => {
    const client = jest.fn().mockResolvedValue({ success: true });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('ASD 123', 'SmartPlug - Living room');
    new SmartPlug(platform, accessory, installation, initial);

    await accessory.getService(hap.Service.Switch)!.getCharacteristic(hap.Characteristic.On).handleSetRequest(true);

    expect(client.mock.calls[0][0].operationName).toBe('smartPlugState');
    expect(client.mock.calls[0][0].variables).toMatchObject({ deviceLabel: 'ASD 123', state: true });
  });

  it('propagates an error when setting the switch state fails', async () => {
    const client = jest.fn().mockRejectedValue(new Error('boom'));
    const installation = makeInstallation(client);
    const accessory = makeAccessory('ASD 123', 'SmartPlug - Living room');
    new SmartPlug(platform, accessory, installation, initial);

    await expect(
      accessory.getService(hap.Service.Switch)!.getCharacteristic(hap.Characteristic.On).handleSetRequest(true)
    ).rejects.toBeDefined();
  });

  it('updates from a poll tick', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('ASD 123', 'SmartPlug - Living room');
    const plug = new SmartPlug(platform, accessory, installation, initial);

    plug.paint({ smartplugs: [{ device: { deviceLabel: 'ASD 123' }, currentState: 'OFF' }] });
    expect(accessory.getService(hap.Service.Switch)!.getCharacteristic(hap.Characteristic.On).value).toBe(false);
  });
});
