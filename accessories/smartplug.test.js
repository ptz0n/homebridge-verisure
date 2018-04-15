const hap = require('hap-nodejs');

const SmartPlug = require('./smartplug');

describe('SmartPlug', () => {
  it.only('setup name and value', () => {
    const homebridge = { hap };
    const config = {
      area: 'Living room',
      currentState: 'ON',
    };

    const smartPlug = new SmartPlug(homebridge, null, config);
    expect(smartPlug.name).toBe('SmartPlug (Living room)');
    expect(smartPlug.value).toBe(1);

    const anotherSmartPlug = new SmartPlug(homebridge, null, { ...config, currentState: 'OFF' });
    expect(anotherSmartPlug.value).toBe(0);
  });
});
