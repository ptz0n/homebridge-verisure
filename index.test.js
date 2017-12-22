const lib = require('./index')

test('exports a function', () => {
  expect(typeof lib).toBe('function')
})

test('registers platform', () => {
  const homebridgeMock = {
    hap: {},
    registerPlatform: (pluginName, platformName, constructor, dynamic) => {
      return {
        pluginName,
        platformName,
        constructor,
        dynamic,
      }
    },
  }

  registeredPlatform = lib(homebridgeMock)
  expect(registeredPlatform).toEqual({
    pluginName: 'homebridge-verisure',
    platformName: 'verisure',
    constructor: registeredPlatform.constructor,
    dynamic: true,
  })
})
