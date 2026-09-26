## 3.0.0 (Sep 26, 2026)

### Breaking

* __BREAKING__: Rewritten in TypeScript, targeting Homebridge 2.0's `DynamicPlatformPlugin` API. Homebridge 1.x is no longer supported.
* __BREAKING__: Node.js 22 is now the minimum supported version (matching Homebridge 2.0's own requirement).
* Accessories are now cached and restored by stable UUID (installation + device label) instead of being fully rebuilt on every restart. Auto-lock and audio are now sub-services of the door lock accessory (as before) rather than separately named accessories; Homebridge will show them as new the first time you start this version.

### Plugin & accessories

* Add support for Homebridge 2.0 (thanks @alexkerber for the original Homebridge 2.0 groundwork in #183); migrate every accessory from the removed `.on('get'/'set')` / `characteristic.getValue()` API to `onGet`/`onSet`/`updateValue`, which was crashing the plugin outright under HAP-NodeJS 1.x/2.x (#190, #186, #185, #184, #175).
* Centralize polling: one overview fetch per installation per `pollInterval` tick, shared by every accessory on it, plus a short-lived cache around ad-hoc HomeKit reads and the door lock's auto-lock/audio config query. Installations with several accessories no longer multiply their API traffic by accessory count - a major contributor to the account rate-limit lockouts in #173, #181, #168.
* Fix the door lock's target-state getter getting stuck reporting a stale target forever after a change settled, which caused HomeKit to repeatedly try to reconcile it (thanks @torandreroland for identifying and prototyping this fix in #161). Combined with the point above, this addresses the reported API-quota exhaustion in #159, #173, #181.
* Only log climate sensor polling at debug level (thanks @torandreroland, #167).
* Tolerate `null` (instead of only missing) `doorWindows`/`climates`/`smartplugs`/`doorlocks` fields from Verisure's GraphQL API, which was crashing the whole overview fetch - and therefore every accessory - on some installations (#188, #189). If the combined overview query itself is rejected for an installation, fall back to fetching each device type with its own query so one broken field doesn't take out the rest.
* Pass `forceArm` (configurable, default `true`) to Verisure's arm mutations, bypassing the "a door/window is open" guard that could otherwise make arming from Home mode fail silently (#56).
* Reject an unrecognized alarm target state (e.g. "Night", which some HomeKit clients like Eve allow selecting despite it not being a supported mode) with a proper HAP error instead of throwing and crashing Homebridge (#85).
* Keep previously discovered accessories in place when a fetch fails at startup (e.g. a brief internet outage right as Homebridge restarts) instead of clearing them (#137).
* Add `excludedAccessoryTypes` and `excludedDevices` config options to hide accessory types or individual devices (#82, #172).
* `bin/verisure` (the `npx homebridge-verisure` cookie helper) now reports a clear error instead of silently swallowing a failed login, and warns if any of the three expected cookies wasn't returned (#164).
* Clearer, specific log messages for expired/invalid cookies (401) and rate-limiting (429) responses, instead of a generic error (#187, #178, #181).
* Give devices with a blank/missing area name a sensible fallback display name instead of `undefined`.

### Dependencies

* Bump `homebridge` dev dependency to `^2.0.0` and `@homebridge/hap-nodejs` to `^2.2.3`.
* Switch tooling to TypeScript, `ts-jest`, and `@typescript-eslint`.
* The companion [`verisure`](https://github.com/ptz0n/node-verisure) transport module has also been modernized on its own branch (native `fetch` instead of `axios`, Node 18+, rate-limit detection) - see its own changelog once released.

## 2.0.2 (Feb 10, 2026)

### Dependencies

* Bump `verisure` module.

## 2.0.1 (Mar 31, 2023)

### Dependencies

* Bump `verisure` module.

## 2.0.0 (Mar 20, 2023)

### Config

* __BREAKING__: Property `cookies` replaces `token`. See README for how to get and configure.

### Plugin & accessories

* Use Verisure GraphQL API.

### Dependencies

* Bump `verisure` module to support GraphQL requests.

## 1.16.0 (Aug 27, 2022)

### Plugin

* Added config options for door lock; auto-lock and volume.

## 1.15.0 (Jan 11, 2022)

### Plugin

* Added config option for installations to initiate.

## 1.14.2 (Jan 4, 2022)

### Plugin

* Initiate gracefully, to not affect other plugins.

## 1.14.1 (Oct 8, 2021)

### Dependencies

* Bump `verisure` module.

## 1.14.0 (Mar 17, 2021)

### Config

* Support for Multi-factor authentication (MFA).

### Dependencies

* Bump `verisure` module.

## 1.13.2 (Feb 28, 2021)

### Plugin

* Return empty list of accessories when initiation fails.

## 1.13.1 (Feb 27, 2021)

### Plugin

* Safer logging when initiating.

## 1.13.0 (Feb 24, 2021)

### Dependencies

* Bump `verisure` module.

## 1.12.1 (Sep 2, 2020)

### Plugin

* Correct schema file for UI.

## 1.12.0 (Sep 1, 2020)

### Plugin

* Add schema file for UI.

## 1.11.0 (Nov 30, 2019)

### Dependencies

* Bump `verisure` module.

## 1.10.1 (Feb 4, 2019)

### Accessories

* Remove night arm from supported states.

## 1.10.0 (Feb 3, 2019)

### Accessories

* Enable configuration of auto-lock via switch service.

### Platform

* Enable configuration using environment variables.

## 1.9.2 (Dec 23, 2018)

### Accessories

* Set supported temperature range.

## 1.9.1 (Jul 5, 2018)

### Accessories

* When unable to set SmartPlug state, pass a correctly composed error object.

## 1.9.0 (Jun 15, 2018)

### Accessories

* Poll for contact sensor state value.

## 1.8.0 (Jun 11, 2018)

### Accessories

* Poll alarm and door lock accessories for current state.

## 1.7.0 (Jun 5, 2018)

### Refactor

* Split platform from accessories.
* Setup linting and unit testing with decent coverage.

### Accessories

* Added support for security system.
* Added support for contact sensors.
* Added humidity service to supported climate sensors.

## Config

* Key `doorcode` changed to `doorCode`.

## 1.6.0 (Jul 20, 2017)

### Accessories

* Added support for door lock (Yale Doorman).

## 1.5.0 (Apr 23, 2017)

### Dependencies

* Bump `verisure` module.

## 1.4.0 (Feb 2, 2017)

### Accessories

* Added support for climate sensor type `HUMIDITY1`.

## 1.3.0 (Jan 25, 2017)

### Accessories

* Added support for climate sensor type `SIREN1`.

## 1.1.0 (Jan 23, 2017)

Initial release with basic support for climate sensors.
