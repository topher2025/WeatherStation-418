# Firmware Documentation

The firmware is the code that runs on the hardware sensor device. It collects weather data and sends it to the backend server.

**Note:** For detailed information about Pico W hardware, GPIO pins, I2C communication, and sockets, see [Hardware Documentation](11-hardware.md).

## What is Firmware?

Firmware is software that runs on embedded devices (hardware like microcontrollers). In this project:
- Firmware = code running on the microcontroller
- Hardware = physical sensor device
- Network = WiFi connection to your home network

## Device Setup

### What You Need

1. **Microcontroller** - ESP32, ESP8266, or similar with WiFi
2. **BME680 Sensor** - Environmental sensor that measures:
   - Temperature (°C)
   - Humidity (%)
   - Pressure (hPa)
   - Gas resistance (Ohms)
3. **USB Cable** - For programming and power
4. **WiFi** - To connect to your network

### Wiring

The sensor connects to the microcontroller via **I2C** (a communication protocol):

```
Microcontroller          BME680 Sensor
     |                        |
   SDA (GPIO 21) -------- SDA
   SCL (GPIO 22) -------- SCL
   GND ---------- GND
   3.3V ---------- VCC
```

**What is I2C?**
- Standard protocol for sensors to communicate
- Uses two wires: SDA (data) and SCL (clock)
- Multiple sensors can share the same I2C bus
- Each sensor has an address (0x77 for BME680)

## Main File: `firmware/main.py`

Let's break down what happens:

### 01. Imports & Setup

```python
from machine import Pin, I2C
import network
from time import sleep
from bme680 import BME680_I2C
import json
import socket
import ujson
```

**What each import does:**
- `machine` - Control hardware (pins, I2C)
- `network` - WiFi connection
- `time.sleep` - Pause execution
- `bme680` - Sensor reading library
- `json` / `ujson` - Format data
- `socket` - Network communication

### 02. Loading Configuration

```python
with open("pins.json") as f:
    pins = json.load(f)
with open("host.json") as f:
    host = ujson.load(f)
```

**pins.json** - Defines which GPIO pins connect to the sensor:
```json
{
    "scl": 22,
    "sda": 21
}
```

**host.json** - Defines where to send data:
```json
{
    "ip": "192.168.1.100",
    "port": 4430
}
```

### 03. Sensor Initialization

```python
i2c = I2C(id=1, scl=Pin(pins["scl"]), sda=Pin(pins["sda"]), freq=100000)
bme = BME680_I2C(i2c=i2c)
```

**What this does:**
1. Creates an I2C connection on pins 21 & 22
2. Sets frequency to 100kHz (standard speed)
3. Creates a BME680 object to read from the sensor
4. The sensor is now ready to use

## Key Functions

### `connect_wifi()`

```python
def connect_wifi():
    ssid = "Eng402"                    # WiFi network name
    password = "IheartCyber"           # WiFi password
    
    wlan = network.WLAN(network.STA_IF)  # Create WiFi interface
    wlan.active(True)                  # Turn on WiFi
    
    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(ssid, password)   # Connect with credentials
        
        timeout = 10                   # Wait up to 10 seconds
        while not wlan.isconnected() and timeout > 0:
            sleep(1)
            timeout -= 1
    
    if wlan.isconnected():
        print("Connected:", wlan.ifconfig())
    else:
        print("Failed to connect")
```

**What happens:**
1. Try to connect to "Eng402" WiFi
2. Wait up to 10 seconds
3. Print result
4. If failed, the device keeps trying (see main loop)

**IP Address:**
- `wlan.ifconfig()` returns: `(ip, subnet, gateway, dns)`
- Example: `('192.168.1.45', '255.255.255.0', '192.168.1.1', '8.8.8.8')`

### `read_sensor()`

```python
def read_sensor():
    try:
        temp = bme.temperature           # Read temperature (Celsius)
        tempC = round(temp, 2)           # Round to 2 decimals
        tempF = round((temp * (9/5) + 32), 2)  # Convert to Fahrenheit
        hum = round(bme.humidity, 2)     # Humidity percentage
        pres = round(bme.pressure, 2)    # Pressure in hPa
        gas = round(bme.gas / 1000, 2)   # Gas in kOhms
        
        out = {
            "temperature_C": tempC,
            "temperature_F": tempF,
            "humidity": hum,
            "pressure": pres,
            "gas": gas,
        }
        
        return out
    except OSError as e:
        print("Failed to read sensor.")
        return {"error": e}
```

**What this does:**
1. Read each measurement from the sensor
2. Round to reasonable precision
3. Convert temperature to both C and F
4. Package into a dictionary
5. Return the data (or error if something went wrong)

**Example output:**
```python
{
    "temperature_C": 22.5,
    "temperature_F": 72.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "gas": 1.5
}
```

### `main()`

```python
def main():
    while True:
        data = read_sensor()      # Get readings
        send_json(data)           # Send to backend
        print(data)               # Print to console
        sleep(5)                  # Wait 5 seconds
```

**This is the main loop:**
- Every 5 seconds, collect sensor data
- Send it to the backend
- Print for debugging
- Repeat forever

### `send_json(data, retries=3)`

This is the most complex function - it sends data to the backend:

```python
def send_json(data, retries=3):
    payload = ujson.dumps(data)  # Convert dict to JSON string
    s = None
    
    # Build HTTP request
    request = (
        "POST {} HTTP/1.1\r\n"
        "Host: {}\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: {}\r\n"
        "Connection: close\r\n"
        "\r\n"
        "{}"
    ).format("/api/s2b/update", host["ip"], len(payload), payload)
```

**HTTP Request Details:**

```
POST /api/s2b/update HTTP/1.1
Host: 192.168.1.100
Content-Type: application/json
Content-Length: 95
Connection: close

{"temperature_C": 22.5, "temperature_F": 72.5, "humidity": 45.2, "pressure": 1013.25, "gas": 1.5}
```

This is a standard HTTP POST request. Let me explain each part:

| Line | Meaning |
|------|---------|
| `POST /api/s2b/update HTTP/1.1` | Send data to this endpoint using HTTP version 1.1 |
| `Host: 192.168.1.100` | Send to this IP address |
| `Content-Type: application/json` | The data is formatted as JSON |
| `Content-Length: 95` | The JSON payload is 95 bytes |
| `Connection: close` | Close connection after response |
| Blank line | Separates headers from body |
| JSON data | The actual sensor readings |

**Continuing with socket communication:**

```python
    for i in range(retries):
        try:
            addr = socket.getaddrinfo(host["ip"], host["port"])[0][-1]
            # Convert IP address to socket address
            
            s = socket.socket()               # Create socket
            s.settimeout(5)                   # Wait max 5 seconds
            s.connect(addr)                   # Connect to backend
            s.sendall(request.encode())       # Send HTTP request
            
            response = b""                    # Empty response buffer
            while True:
                chunk = s.recv(1024)          # Receive up to 1024 bytes
                if not chunk:                 # No more data?
                    break
                response += chunk             # Add to response
            
            # Parse the response
            status_line = response.split(b"\r\n", 1)[0]
            parts = status_line.split()
            if len(parts) < 2:
                raise ValueError("Malformed HTTP response")
            
            status_code = int(parts[1])       # Extract HTTP status code
            if 200 <= status_code < 300:      # Success? (200-299)
                return response.decode()
            
            raise RuntimeError("HTTP {}".format(status_code))
        
        except Exception as e:
            print(e)                          # Print error
        
        finally:
            if s:
                s.close()                     # Always close socket
    
    return None                               # Failed after retries
```

**How it works:**

1. **Create socket** - Open a network connection
2. **Connect** - Establish TCP connection to backend server
3. **Send request** - Send the HTTP request with JSON data
4. **Receive response** - Read bytes from the connection
5. **Parse response** - Extract HTTP status code
6. **Check success** - If 200-299, success
7. **Retry on failure** - Try up to 3 times before giving up
8. **Close socket** - Always clean up the connection

**Status codes:**
- `200-299` - Success ✅
- `400` - Bad request (malformed JSON)
- `401` - Unauthorized (authentication failed)
- `422` - Invalid data (failed validation)
- `500` - Server error (backend crashed)

## The BME680 Sensor Library: `firmware/bme680.py`

This is a driver that knows how to communicate with the BME680 sensor.

### What's Inside

The file contains:
- **Adafruit_BME680** - Base class with sensor logic
- **BME680_I2C** - I2C specific implementation

### Key Methods

```python
bme.temperature     # Returns temperature in °C
bme.humidity        # Returns humidity in %
bme.pressure        # Returns pressure in hPa
bme.gas             # Returns gas resistance in Ohms
bme.altitude        # Returns altitude (calculated from pressure)
```

### Advanced Settings

```python
bme.temperature_oversample = 16    # More samples = more accurate but slower
bme.pressure_oversample = 16
bme.humidity_oversample = 8
bme.filter_size = 7                # Smoothing filter
```

Most of the code is mathematics to convert raw sensor data to meaningful values. Don't worry about understanding every detail!

## Configuration Files

### `pins.json` - Pin Configuration

```json
{
    "scl": 22,
    "sda": 21
}
```

**Customization:** If your microcontroller uses different pins, change these values.

### `host.json` - Backend Server

```json
{
    "ip": "192.168.1.100",
    "port": 4430
}
```

**Customization:** Change `ip` to wherever your backend is running:
- Local network: `192.168.x.x`
- Cloud server: `example.com` or IP address
- Port should match backend configuration (usually 4430 for HTTPS)

## Data Flow

```
1. Power on microcontroller
2. Load pins.json and host.json
3. Initialize I2C to sensor
4. Connect to WiFi
5. Enter main loop:
   a. Read sensor (get 5 values)
   b. Package as JSON
   c. Send HTTP POST to backend
   d. Wait 5 seconds
   e. Repeat
6. If WiFi lost, reconnect
7. If send fails, retry up to 3 times
```

## Debugging

### Serial Console Output

Connect via USB and monitor the serial output:

```
Connecting to WiFi...
Connected to WiFi: ('192.168.1.45', '255.255.255.0', '192.168.1.1', '8.8.8.8')
{'temperature_C': 22.5, 'temperature_F': 72.5, 'humidity': 45.2, 'pressure': 1013.25, 'gas': 1.5}
{'temperature_C': 22.6, 'temperature_F': 72.7, 'humidity': 45.1, 'pressure': 1013.24, 'gas': 1.4}
Failed to read sensor.
```

**What this means:**
- Connected successfully
- Readings are being sent
- Sometimes sensor read fails (usually recovers next try)

### Troubleshooting

**"Failed to connect to WiFi"**
- Check SSID and password
- Make sure WiFi is in range
- Restart microcontroller

**"No readings coming through"**
- Check sensor wiring (SCL, SDA, GND, VCC)
- Verify pins.json has correct GPIO numbers
- Check I2C address (usually 0x77 for BME680)

**"Sending fails with HTTP error"**
- Check host.json IP and port
- Make sure backend is running and accessible
- Try pinging the IP address from your computer

## Advanced Topics

### HTTPS/SSL

Currently uses HTTP (plain text). For production:
1. Backend provides SSL certificates
2. Use `ssl` module to create secure socket:
   ```python
   import ssl
   s = socket.socket()
   s = ssl.wrap_socket(s, cert_reqs=ssl.CERT_NONE)  # Ignore cert verification for now
   ```

### Handling Lost WiFi

Current code stops working if WiFi drops. Better approach:
```python
def main():
    while True:
        if not wlan.isconnected():
            connect_wifi()
        
        data = read_sensor()
        send_json(data)
        sleep(5)
```

### Power Management

Microcontrollers are power-efficient, but you can save more:
```python
# Put sensor to sleep between readings
bme._write(0x75, [0])  # Sleep mode

# Or use deep sleep (wakes up at interval)
from machine import deepsleep
deepsleep(5000)  # Sleep 5 seconds, then restart
```

### Error Logging

Save errors to SD card or flash:
```python
with open('errors.log', 'a') as f:
    f.write(f"Error at {time.time()}: {error}\n")
```

## MicroPython vs Python

MicroPython is a smaller version of Python for embedded devices:

| Feature | Python | MicroPython |
|---------|--------|-------------|
| Size | 100 MB | < 5 MB |
| Speed | Faster | Slower |
| Libraries | 1000s available | Limited |
| Memory use | Lots | Very little |
| File system | Full | Limited |

**MicroPython differences:**
- `ujson` instead of `json`
- No `requests` library (use `socket` instead)
- No file I/O on some devices
- Limited memory means some code won't fit

## Example: Adding a Second Sensor

To add another sensor (like a light sensor):

```python
# In main.py
from bme680 import BME680_I2C

# Add to setup:
light_pin = Pin(35, Pin.IN)  # Read analog value

# In read_sensor():
def read_sensor():
    # ... existing code ...
    light = light_pin.read()  # Read light level (0-1023)
    
    out = {
        # ... existing fields ...
        "light": light
    }
    return out
```

Then backend needs to accept and store this new field.

## Performance Metrics

**Current performance:**
- Sensor read time: ~10 ms
- WiFi send time: ~100-500 ms
- Power consumption: ~100 mA when sending, ~10 mA idle
- Data per reading: ~100 bytes
- Data per day: 100 bytes × (60/5) × 24 = ~28 KB

**With 1 GB storage:**
- Could store: ~36 years of data (if saved locally)
- Current usage: ~2 MB per year on backend

## Safety Features

1. **Timeout** - If backend doesn't respond in 5 seconds, timeout
2. **Retry** - Try 3 times before giving up
3. **Error handling** - Catches exceptions so device doesn't crash
4. **Validation** - Backend validates data before storing

## Future Enhancements

1. **Caching** - Store readings locally if WiFi is down, sync later
2. **Configuration over WiFi** - Receive pin/host config from backend
3. **Over-the-air updates** - Push new firmware without USB
4. **Multiple sensors** - Support more BME680s on different addresses
5. **Low power mode** - Reduce sample rate or increase sleep time


