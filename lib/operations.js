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
};
