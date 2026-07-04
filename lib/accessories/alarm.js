const VerisureAccessory = require('./verisure');

const {
  overviewOperation,
  armAwayOperation,
  armHomeOperation,
  disarmOperation,
  pollArmStateOperation,
} = require('../operations');

class Alarm extends VerisureAccessory {
  constructor(...args) {
    super(...args);

    const { alarmCode } = this.platformConfig;
    this.alarmCode = alarmCode.toString();
    this.model = 'ALARM';
    this.name = VerisureAccessory.getUniqueAccessoryName(`Alarm - ${this.installation.config.alias}`);

    const { SecuritySystemCurrentState } = this.homebridge.hap.Characteristic;
    this.armStateMap = {
      ARMED_AWAY: SecuritySystemCurrentState.AWAY_ARM,
      ARMED_HOME: SecuritySystemCurrentState.STAY_ARM,
      DISARMED: SecuritySystemCurrentState.DISARMED,
    };
  }

  resolveArmState(input) {
    let output;

    // Verisure to HAP
    if (typeof input === 'string') {
      output = this.armStateMap[input];
    }

    // HAP to Verisure
    if (typeof input === 'number') {
      output = Object.keys(this.armStateMap).find((key) => this.armStateMap[key] === input);
    }

    if (typeof output === 'undefined') {
      throw Error(`Cannot resolve arm state from unknown input: ${input}`);
    }

    return output;
  }

  async getCurrentAlarmState() {
    this.log('Getting current alarm state.', 'debug');

    const overview = await this.installation.client(overviewOperation);
    return this.resolveArmState(overview.installation.armState.statusType);
  }

  async setTargetAlarmState(value) {
    this.log(`Setting target alarm state to: ${value}`);

    const targetArmState = this.resolveArmState(value);

    const operation = {
      ARMED_AWAY: armAwayOperation,
      ARMED_HOME: armHomeOperation,
      DISARMED: disarmOperation,
    }[targetArmState](this.alarmCode);

    let transactionId;
    try {
      ({ transactionId } = await this.installation.client(operation));
    } catch (error) {
      if (error.name !== 'GraphqlException') {
        throw error;
      }
      this.log(`Arm state change to ${targetArmState} failed: ${JSON.stringify(error.errors)}. Retrying once.`, 'warn');
      await new Promise((resolve) => { setTimeout(resolve, 2000); });
      try {
        ({ transactionId } = await this.installation.client(operation));
      } catch (retryError) {
        if (retryError.name === 'GraphqlException') {
          retryError.message += `: ${JSON.stringify(retryError.errors)}`;
        }
        throw retryError;
      }
    }

    await this.resolveChangeResult(
      pollArmStateOperation(transactionId, targetArmState)
    );

    setImmediate(() => {
      const { SecuritySystemCurrentState } = this.homebridge.hap.Characteristic;
      this.service.updateCharacteristic(SecuritySystemCurrentState, value);
    });
  }

  getServices() {
    const { Service, Characteristic } = this.homebridge.hap;

    this.service = new Service.SecuritySystem(this.name);

    const currentStateCharacteristic = this.service
      .getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(this.getCurrentAlarmState.bind(this));

    const targetStateCharacteristic = this.service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(this.getCurrentAlarmState.bind(this))
      .onSet(this.setTargetAlarmState.bind(this));

    const { NIGHT_ARM } = Characteristic.SecuritySystemTargetState;
    const validValues = targetStateCharacteristic.props.validValues
      .filter((state) => state !== NIGHT_ARM);
    targetStateCharacteristic.setProps({ validValues });

    this.accessoryInformation.setCharacteristic(Characteristic.Model, this.model);

    this.pollCharacteristics.push({
      characteristic: currentStateCharacteristic,
      getter: this.getCurrentAlarmState.bind(this),
    });

    return [this.accessoryInformation, this.service];
  }
}

module.exports = Alarm;
