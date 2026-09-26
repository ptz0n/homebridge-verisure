import type { GraphqlOperation } from 'verisure';

/**
 * The combined query used on the common/fast path: one request covers every
 * accessory type. Some installations (observed on certain PreSense/non-Yale
 * setups) have Verisure's own GraphQL server reject this query outright with
 * e.g. `Expected Iterable, but did not find one for field
 * "Installation.doorWindows"` when a sub-resolver returns `null` instead of
 * `[]` - see issues #188, #189. `OverviewPoller` catches that and falls back
 * to the individual per-domain queries below, so a broken field for one
 * installation doesn't take down every accessory type on it.
 */
export const overviewOperation: GraphqlOperation = {
  operationName: 'Overview',
  query: `query Overview($giid: String!) {
    installation(giid: $giid) {
      alias
      locale
      climates {
        device {
          deviceLabel
          area
          gui {
            label
            __typename
          }
          __typename
        }
        humidityEnabled
        humidityTimestamp
        humidityValue
        temperatureTimestamp
        temperatureValue
        thresholds {
          aboveMaxAlert
          belowMinAlert
          sensorType
          __typename
        }
        __typename
      }
      armState {
        type
        statusType
        date
        name
        changedVia
        __typename
      }
      doorWindows {
        device {
          deviceLabel
          area
          gui {
            support
            label
            __typename
          }
          __typename
        }
        type
        state
        wired
        reportTime
        __typename
      }
      smartplugs {
        device {
          deviceLabel
          area
          gui {
            support
            label
            __typename
          }
          __typename
        }
        currentState
        icon
        isHazardous
        __typename
      }
      doorlocks {
        device {
          area
          deviceLabel
          __typename
        }
        currentLockState
        __typename
      }
      __typename
    }
  }`,
};

export const armStateOperation: GraphqlOperation = {
  operationName: 'ArmState',
  query: `query ArmState($giid: String!) {
    installation(giid: $giid) {
      armState {
        type
        statusType
        date
        name
        changedVia
        __typename
      }
      __typename
    }
  }`,
};

export const climatesOperation: GraphqlOperation = {
  operationName: 'Climate',
  query: `query Climate($giid: String!) {
    installation(giid: $giid) {
      climates {
        device {
          deviceLabel
          area
          gui {
            label
            __typename
          }
          __typename
        }
        humidityEnabled
        humidityTimestamp
        humidityValue
        temperatureTimestamp
        temperatureValue
        __typename
      }
      __typename
    }
  }`,
};

export const doorWindowsOperation: GraphqlOperation = {
  operationName: 'DoorWindow',
  query: `query DoorWindow($giid: String!) {
    installation(giid: $giid) {
      doorWindows {
        device {
          deviceLabel
          area
          gui {
            support
            label
            __typename
          }
          __typename
        }
        type
        state
        wired
        reportTime
        __typename
      }
      __typename
    }
  }`,
};

export const smartplugsOperation: GraphqlOperation = {
  operationName: 'SmartPlug',
  query: `query SmartPlug($giid: String!) {
    installation(giid: $giid) {
      smartplugs {
        device {
          deviceLabel
          area
          gui {
            support
            label
            __typename
          }
          __typename
        }
        currentState
        icon
        isHazardous
        __typename
      }
      __typename
    }
  }`,
};

export const doorlocksOperation: GraphqlOperation = {
  operationName: 'SmartLock',
  query: `query SmartLock($giid: String!) {
    installation(giid: $giid) {
      doorlocks {
        device {
          area
          deviceLabel
          __typename
        }
        currentLockState
        __typename
      }
      __typename
    }
  }`,
};

export const armAwayOperation = (code: string, forceArm: boolean): GraphqlOperation => ({
  operationName: 'armAway',
  variables: { code, forceArm },
  query: `mutation armAway($giid: String!, $code: String!, $forceArm: Boolean) {
    transactionId: armStateArmAway(giid: $giid, code: $code, forceArm: $forceArm)
  }`,
});

export const armHomeOperation = (code: string, forceArm: boolean): GraphqlOperation => ({
  operationName: 'armHome',
  variables: { code, forceArm },
  query: `mutation armHome($giid: String!, $code: String!, $forceArm: Boolean) {
    transactionId: armStateArmHome(giid: $giid, code: $code, forceArm: $forceArm)
  }`,
});

export const disarmOperation = (code: string): GraphqlOperation => ({
  operationName: 'disarm',
  variables: { code },
  query: `mutation disarm($giid: String!, $code: String!) {
    transactionId: armStateDisarm(giid: $giid, code: $code)
  }`,
});

export const pollArmStateOperation = (transactionId: string, futureState: string): GraphqlOperation => ({
  operationName: 'pollArmState',
  variables: { transactionId, futureState },
  query: `query pollArmState($giid: String!, $transactionId: String, $futureState: ArmStateStatusTypes!) {
    installation(giid: $giid) {
      pollResult: armStateChangePollResult(transactionId: $transactionId, futureState: $futureState) {
        result
        createTime
        __typename
      }
      __typename
    }
  }`,
});

export const smartPlugStateOperation = (deviceLabel: string, state: boolean): GraphqlOperation => ({
  operationName: 'smartPlugState',
  variables: { deviceLabel, state },
  query: `mutation smartPlugState($giid: String!, $deviceLabel: String!, $state: Boolean!) {
    SmartPlugSetState(giid: $giid, input: [{deviceLabel: $deviceLabel, state: $state}])
  }`,
});

export const doorLockOperation = (deviceLabel: string, code: string): GraphqlOperation => ({
  operationName: 'DoorLock',
  variables: { deviceLabel, input: { code } },
  query: `mutation DoorLock($giid: String!, $deviceLabel: String!, $input: LockDoorInput!) {
    transactionId: DoorLock(giid: $giid, deviceLabel: $deviceLabel, input: $input)
  }`,
});

export const doorUnlockOperation = (deviceLabel: string, code: string): GraphqlOperation => ({
  operationName: 'DoorUnlock',
  variables: { deviceLabel, input: { code } },
  query: `mutation DoorUnlock($giid: String!, $deviceLabel: String!, $input: LockDoorInput!) {
    transactionId: DoorUnlock(giid: $giid, deviceLabel: $deviceLabel, input: $input)
  }`,
});

export const pollLockStateOperation = (
  transactionId: string,
  deviceLabel: string,
  futureState: string
): GraphqlOperation => ({
  operationName: 'pollLockState',
  variables: { transactionId, deviceLabel, futureState },
  query: `query pollLockState($giid: String!, $transactionId: String, $deviceLabel: String!, $futureState: DoorLockState!) {
    installation(giid: $giid) {
      pollResult: doorLockStateChangePollResult(transactionId: $transactionId, deviceLabel: $deviceLabel, futureState: $futureState) {
        result
        createTime
        __typename
      }
      __typename
    }
  }`,
});

export const doorLockConfigOperation = (deviceLabel: string): GraphqlOperation => ({
  operationName: 'DoorLockConfiguration',
  variables: { deviceLabel },
  query: `query DoorLockConfiguration($giid: String!, $deviceLabel: String!) {
    installation(giid: $giid) {
      smartLocks(filter: {deviceLabels: [$deviceLabel]}) {
        device {
          area
          deviceLabel
          __typename
        }
        configuration {
          ... on YaleLockConfiguration {
            autoLockEnabled
            voiceLevel
            volume
            __typename
          }
          ... on DanaLockConfiguration {
            holdBackLatchDuration
            twistAssistEnabled
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }`,
});

export const doorLockUpdateConfigOperation = (
  deviceLabel: string,
  input: Record<string, unknown>
): GraphqlOperation => ({
  operationName: 'DoorLockUpdateConfig',
  variables: { deviceLabel, input },
  query: `mutation DoorLockUpdateConfig($giid: String!, $deviceLabel: String!, $input: DoorLockUpdateConfigInput!) {
    DoorLockUpdateConfig(giid: $giid, deviceLabel: $deviceLabel, input: $input)
  }`,
});
