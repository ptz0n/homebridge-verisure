## 2.0.2 (Feb 10, 2026)

### Dependencies

* Bump `verisure` module.

## 2.0.1 (Mar 31, 2021)

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
