const accessories = require('./index');

describe('Accessories', () => {
  Object.keys(accessories).forEach((key) => {
    const Accessory = accessories[key];
    const methods = Object.getOwnPropertyNames(Accessory.prototype);

    it(`${key} exposes required methods`, () => {
      expect(methods).toContain('constructor');
      expect(methods).toContain('getServices');
    });
  });
});
