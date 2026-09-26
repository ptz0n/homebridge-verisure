import * as hap from '@homebridge/hap-nodejs';

import { makeAccessory, makeInstallation, makePlatform } from '../test/helpers';
import { ContactSensor } from './contactSensor';

describe('ContactSensor', () => {
  const platform = makePlatform();

  it('gets the current state from the overview', async () => {
    const client = jest.fn().mockResolvedValue({
      installation: { doorWindows: [{ device: { deviceLabel: 'DEFG 4567' }, state: 'OPEN' }] },
    });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('DEFG 4567', 'Front door');
    new ContactSensor(platform, accessory, installation);

    const value = await accessory.getService(hap.Service.ContactSensor)!
      .getCharacteristic(hap.Characteristic.ContactSensorState).handleGetRequest();
    expect(value).toBe(1); // DETECTED / open
  });

  it('updates from a poll tick, treating anything other than CLOSE as detected', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('DEFG 4567', 'Front door');
    const sensor = new ContactSensor(platform, accessory, installation);

    sensor.paint({ doorWindows: [{ device: { deviceLabel: 'DEFG 4567' }, state: 'CLOSE' }] });
    expect(
      accessory.getService(hap.Service.ContactSensor)!.getCharacteristic(hap.Characteristic.ContactSensorState).value
    ).toBe(0);

    sensor.paint({ doorWindows: [{ device: { deviceLabel: 'DEFG 4567' }, state: 'OPEN' }] });
    expect(
      accessory.getService(hap.Service.ContactSensor)!.getCharacteristic(hap.Characteristic.ContactSensorState).value
    ).toBe(1);
  });

  it('does not crash when this device is missing from the overview', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('DEFG 4567', 'Front door');
    const sensor = new ContactSensor(platform, accessory, installation);
    expect(() => sensor.paint({ doorWindows: [] })).not.toThrow();
  });
});
