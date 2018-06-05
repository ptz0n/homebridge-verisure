# homebridge-verisure

[![Greenkeeper badge](https://badges.greenkeeper.io/ptz0n/homebridge-verisure.svg)](https://greenkeeper.io/)

[![](https://travis-ci.org/ptz0n/homebridge-verisure.svg?branch=master)](https://travis-ci.org/ptz0n/homebridge-verisure)

This is a plugin for [homebridge](https://github.com/nfarina/homebridge). It's
an implementation for your Verisure installation and exposes the following devices:

- Climate sensor
- Magnetic contact
- Night Control
- Siren
- SmartLock
- SmartPlug
- Smoke detector
- Vibration detector

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
    "doorCode": "000000"
  }
]
```

* __`email`__ Required string containing your Verisure account email address.
* __`password`__ Required string containing your Verisure account password.
* `alarmCode` Optional string containing your security system alarm code.
* `doorCode` Optional string containing your door lock code.
