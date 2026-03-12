# Sensors

## Overview

The current weather station firmware uses a single environmental sensor:

- **BME680** (temperature, humidity, pressure, gas resistance)

The sensor is read by the Pico firmware in `firmware/main.py` using the local BME680 driver in `firmware/bme680.py`.

## Hardware Interface

The BME680 is connected over I2C bus 1.

Pin assignments are loaded from `firmware/pins.json`:

```json
{
  "scl": 7,
  "sda": 6
}
```

Firmware initialization:

```python
i2c = I2C(id=1, scl=Pin(pins['scl']), sda=Pin(pins['sda']), freq=100000)
bme = BME680_I2C(i2c=i2c)
```

## Read Cycle

`main()` runs continuously and reads the sensor once per second:

1. Call `read_sensor()`
2. Read BME680 properties
3. Format values into a dictionary
4. Print the result
5. Sleep for 1 second

## Output Fields and Units

`read_sensor()` returns:

- `temperature_C`: degrees Celsius
- `temperature_F`: degrees Fahrenheit
- `humidity`: percent relative humidity (%RH)
- `pressure`: hectopascals (hPa)
- `gas`: kilo-ohms (kOhms), converted from raw ohms (`bme.gas / 1000`)

Example output:

```python
{
  'temperature_C': 24.31,
  'temperature_F': 75.76,
  'humidity': 48.22,
  'pressure': 1009.14,
  'gas': 11.53
}
```

## BME680 Driver Notes

The driver class `BME680_I2C` defaults to:

- I2C address `0x77`
- refresh rate `10` Hz (internal minimum refresh timing)

On startup, the driver checks the chip ID (`0x61`). If the check fails, it raises:

- `RuntimeError('Failed 0x%x' % chip_id)`

## Error Handling and Failure Modes

In `read_sensor()`, I/O failures are caught as `OSError`:

- Firmware prints `Failed to read sensor.`
- Return payload becomes `{'error': e}`

Common causes:

- Incorrect `scl`/`sda` pin values in `pins.json`
- Loose wiring or power issues
- Wrong BME680 I2C address for the board variant

## Quick Validation

Use this checklist during bring-up:

1. Confirm `pins.json` matches physical wiring (`scl=7`, `sda=6` by default).
2. Boot firmware and watch serial output.
3. Verify readings update every ~1 second.
4. Confirm reasonable ranges:
   - Temperature: environment-dependent
   - Humidity: `0` to `100`
   - Pressure: roughly `900` to `1100` hPa at typical elevations
   - Gas: positive value in kOhms
5. If you see `{'error': ...}` repeatedly, check I2C wiring and sensor address first.

