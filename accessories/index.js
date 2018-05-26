const Alarm = require('./alarm');
const ClimateSensor = require('./climatesensor');
const ContactSensor = require('./contactsensor');
const DoorLock = require('./doorlock');
const SmartPlug = require('./smartplug');

module.exports = {
  alarm: Alarm,
  climateSensor: ClimateSensor,
  contactSensor: ContactSensor,
  doorLock: DoorLock,
  smartPlug: SmartPlug,
};
