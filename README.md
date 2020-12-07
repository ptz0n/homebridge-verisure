# homebridge-verisure

[![Greenkeeper badge](https://badges.greenkeeper.io/ptz0n/homebridge-verisure.svg)](https://greenkeeper.io/)

[![GitHub Actions badge](https://github.com/ptz0n/homebridge-verisure/workflows/Test/badge.svg)](https://github.com/ptz0n/homebridge-verisure/actions?query=workflow%3ATest)

This is a plugin for [Homebridge](https://github.com/nfarina/homebridge). It's
an implementation for your Verisure installation and exposes the following devices:

- Security alarm
- Climate sensor
- Magnetic contact
- Night Control
- Siren
- SmartLock
- SmartPlug
- Smoke detector
- Vibration detector

## Protect linked devices & accounts

If configured, this plugin will expose your security system and door lock.
Please protect you installation from unauthorised access:

1. Generate a unique `pin` for your config. Never, ever use the default one.
2. Lock all devices with access to your installation when not in use.
3. Remove access from users that no longer need it.
4. Keep your devices up to date.

## Installation

```bash
npm install -g homebridge-verisure
```

Now you can update your configuration file to enable the plugin, see sample
snippet below.

## Configuration

As part of your configuration, add an object with your Verisure credentials to
your array (list) of enabled platform plugins. Example config:

```json
"platforms": [
  {
    "platform" : "verisure",
    "name" : "Verisure",
    "email": "your@email.com",
    "password": "yourT0p5ecre7Passw0rd",
    "alarmCode": "0000",
    "doorCode": "000000",
    "pollInterval": 60
  }
]
```

* __`email`__ Required string containing your Verisure account email address.
* __`password`__ Required string containing your Verisure account password.
* `alarmCode` Optional string containing your security system alarm code.
* `doorCode` Optional string containing your door lock code.
* `pollInterval` Optional integer containing poll interval in seconds. Defaults to `60`.

### Environment variables

For convenience, the following environment variables can be used instead of placing secrets in your `config.json`.

* `VERISURE_ALARM_CODE`
* `VERISURE_DOOR_CODE`
* `VERISURE_EMAIL`
* `VERISURE_PASSWORD`
