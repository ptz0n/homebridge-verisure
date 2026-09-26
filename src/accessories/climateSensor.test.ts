import * as hap from '@homebridge/hap-nodejs';

import { makeAccessory, makeInstallation, makePlatform } from '../test/helpers';
import type { Climate } from '../types';
import { ClimateSensor } from './climateSensor';

const climate: Climate = {
  device: {
    deviceLabel: 'asd123',
    area: 'Hallway',
    gui: { label: 'SMOKE' },
  },
  humidityValue: 55,
  temperatureValue: 22,
};

describe('ClimateSensor', () => {
  const platform = makePlatform();

  it('exposes both temperature and humidity services when both values are present', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('asd123');
    // eslint-disable-next-line no-new
    new ClimateSensor(platform, accessory, installation, climate);

    expect(accessory.getService(hap.Service.TemperatureSensor)).toBeDefined();
    expect(accessory.getService(hap.Service.HumiditySensor)).toBeDefined();
  });

  it('only exposes a temperature service when humidity is absent', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('asd456');
    const tempOnly: Climate = { device: { deviceLabel: 'asd456', gui: { label: 'SMOKE' } }, temperatureValue: 22.5 };
    // eslint-disable-next-line no-new
    new ClimateSensor(platform, accessory, installation, tempOnly);

    expect(accessory.getService(hap.Service.TemperatureSensor)).toBeDefined();
    expect(accessory.getService(hap.Service.HumiditySensor)).toBeUndefined();
  });

  it('gets the current temperature from the overview', async () => {
    const client = jest.fn().mockResolvedValue({ installation: { climates: [{ ...climate, temperatureValue: 22.5 }] } });
    const installation = makeInstallation(client);
    const accessory = makeAccessory('asd123');
    new ClimateSensor(platform, accessory, installation, climate);

    const value = await accessory.getService(hap.Service.TemperatureSensor)!
      .getCharacteristic(hap.Characteristic.CurrentTemperature).handleGetRequest();
    expect(value).toBe(22.5);
  });

  it('updates both services from a poll tick', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('asd123');
    const sensor = new ClimateSensor(platform, accessory, installation, climate);

    sensor.paint({
      climates: [{ ...climate, temperatureValue: 30, humidityValue: 40 }],
    });

    const temperatureService = accessory.getService(hap.Service.TemperatureSensor)!;
    const humidityService = accessory.getService(hap.Service.HumiditySensor)!;
    expect(temperatureService.getCharacteristic(hap.Characteristic.CurrentTemperature).value).toBe(30);
    expect(humidityService.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity).value).toBe(40);
  });

  it('does not crash when this device is missing from a poll tick overview', () => {
    const installation = makeInstallation(jest.fn());
    const accessory = makeAccessory('asd123');
    const sensor = new ClimateSensor(platform, accessory, installation, climate);

    expect(() => sensor.paint({ climates: [] })).not.toThrow();
  });
});
