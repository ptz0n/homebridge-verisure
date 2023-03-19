module.exports = {
  overviewOperation: {
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
  },

  armAwayOperation: (code) => ({
    operationName: 'armAway',
    variables: { code },
    query: `mutation armAway($giid: String!, $code: String!) {
      transactionId: armStateArmAway(giid: $giid, code: $code)
    }`,
  }),

  armHomeOperation: (code) => ({
    operationName: 'armHome',
    variables: { code },
    query: `mutation armHome($giid: String!, $code: String!) {
      transactionId: armStateArmHome(giid: $giid, code: $code)
    }`,
  }),

  disarmOperation: (code) => ({
    operationName: 'disarm',
    variables: { code },
    query: `mutation disarm($giid: String!, $code: String!) {
      transactionId: armStateDisarm(giid: $giid, code: $code)
    }`,
  }),

  pollArmStateOperation: (transactionId, futureState) => ({
    operationName: 'pollArmState',
    variables: {
      transactionId,
      futureState,
    },
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
  }),

  smartPlugStateOperation: (deviceLabel, state) => ({
    operationName: 'smartPlugState',
    variables: {
      deviceLabel,
      state,
    },
    query: `mutation smartPlugState($giid: String!, $deviceLabel: String!, $state: Boolean!) {
      SmartPlugSetState(giid: $giid, input: [{deviceLabel: $deviceLabel, state: $state}])
    }`,
  }),

  doorLockOperation: (deviceLabel, code) => ({
    operationName: 'DoorLock',
    variables: {
      deviceLabel,
      input: { code },
    },
    query: `mutation DoorLock($giid: String!, $deviceLabel: String!, $input: LockDoorInput!) {
      transactionId: DoorLock(giid: $giid, deviceLabel: $deviceLabel, input: $input)
    }`,
  }),

  doorUnlockOperation: (deviceLabel, code) => ({
    operationName: 'DoorUnlock',
    variables: {
      deviceLabel,
      input: { code },
    },
    query: `mutation DoorUnlock($giid: String!, $deviceLabel: String!, $input: LockDoorInput!) {
      transactionId: DoorUnlock(giid: $giid, deviceLabel: $deviceLabel, input: $input)
    }`,
  }),

  pollLockStateOperation: (transactionId, deviceLabel, futureState) => ({
    operationName: 'pollLockState',
    variables: {
      transactionId,
      deviceLabel,
      futureState,
    },
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
  }),

  doorLockConfigOperation: (deviceLabel) => ({
    operationName: 'DoorLockConfiguration',
    variables: {
      deviceLabel,
    },
    query: `query DoorLockConfiguration($giid: String!, $deviceLabel: String!) {
      installation(giid: $giid) {
        smartLock: smartLocks(filter: {deviceLabels: [$deviceLabel]}) {
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
            __typename
          }
          __typename
        }
        __typename
      }
    }`,
  }),

  doorLockUpdateConfigOperation: (deviceLabel, input) => ({
    operationName: 'DoorLockUpdateConfig',
    variables: {
      deviceLabel,
      input,
    },
    query: `mutation DoorLockUpdateConfig($giid: String!, $deviceLabel: String!, $input: DoorLockUpdateConfigInput!) {
      DoorLockUpdateConfig(giid: $giid, deviceLabel: $deviceLabel, input: $input)
    }`,
  }),
};
