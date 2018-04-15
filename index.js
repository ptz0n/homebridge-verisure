const VerisurePlatform = require('./platform');

module.exports = (homebridge) => {
  VerisurePlatform.init(homebridge);
  homebridge.registerPlatform('homebridge-verisure', 'verisure', VerisurePlatform);
};
