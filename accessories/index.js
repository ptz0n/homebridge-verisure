const Alarm = require('./alarm');
const ClimateSensor = require('./climatesensor');
const DoorLock = require('./doorlock');
const SmartPlug = require('./smartplug');

module.exports = {
  alarm: Alarm,
  climateSensor: ClimateSensor,
  doorLock: DoorLock,
  smartPlug: SmartPlug,
};
