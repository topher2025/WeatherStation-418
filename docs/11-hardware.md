# Pico Hardware & Code Interaction

This document explains the hardware components of the Pico W microcontroller and how the firmware code interacts with them through sockets, sensors, and I2C communication.

## Table of Contents

1. [Pico W Hardware Overview](#pico-w-hardware-overview)
2. [GPIO Pins & Configuration](#gpio-pins--configuration)
3. [I2C Communication (BME680 Sensor)](#i2c-communication-bme680-sensor)
4. [Network Sockets & WiFi](#network-sockets--wifi)
5. [Firmware Code Interaction](#firmware-code-interaction)
6. [Power Management](#power-management)
7. [Debugging & Troubleshooting](#debugging--troubleshooting)

---

## Pico W Hardware Overview

### What is the Pico W?

The **Raspberry Pi Pico W** is a small microcontroller board designed for embedded applications:

```
┌─────────────────────────────────────────┐
│     Raspberry Pi Pico W Board           │
│                                         │
│  RP2040 CPU                             │
│  ├─ Dual ARM Cortex-M0+ @ 125 MHz       │
│  ├─ 264 KB RAM                          │
│  └─ 2 MB Flash storage                  │
│                                         │
│  Wireless                               │
│  ├─ WiFi 802.11b/g/n (2.4 GHz)          │
│  └─ Bluetooth LE                        │
│                                         │
│  I/O                                    │
│  ├─ 26 GPIO pins                        │
│  ├─ 3 Analog inputs                     │
│  ├─ I2C, SPI, UART interfaces           │
│  └─ USB port (for programming)          │
│                                         │
│  Power                                  │
│  ├─ 5V USB power                        │
│  ├─ 3.3V output (for sensors)           │
│  └─ GND (ground)                        │
└─────────────────────────────────────────┘
```

### Key Specs

| Component | Specification |
|-----------|---------------|
| CPU | Dual ARM Cortex-M0+ @ 125 MHz |
| RAM | 264 KB |
| Storage | 2 MB Flash |
| GPIO Pins | 26 digital I/O |
| Analog Inputs | 3 (12-bit ADC) |
| Interfaces | I2C, SPI, UART, USB |
| WiFi | 802.11b/g/n 2.4 GHz |
| Power | 5V USB (3.3V logic) |

---

## GPIO Pins & Configuration

### What are GPIO Pins?

**GPIO** = General Purpose Input/Output

These pins allow the Pico to:
- Read digital inputs (HIGH/LOW, 1/0)
- Write digital outputs (turn things on/off)
- Communicate with sensors and modules

### Pin Layout

```
Pico W Pin Layout (looking at USB end at top):

         USB
         ┌──┐
    1 ┌──┤  ├──┐ 40
    2 │ GND      │ 39  (GND)
    3 │ GP0  5V  │ 38
    4 │ GP1  GND │ 37
    5 │ GP2      │ 36  (3V3_EN)
    6 │ GP3      │ 35  (3V3)
    7 │ GP4      │ 34  (GND)
    8 │ GP5  GP28│ 33
    9 │ GND  GND │ 32
   10 │ GP6  GP27│ 31
   11 │ GP7  GND │ 30
   12 │ GP8      │ 29  (GP26)
   13 │ GP9      │ 28  (GND)
   14 │ GND  GP25│ 27
   15 │ GP10     │ 26  (GP24)
   16 │ GP11     │ 25  (GND)
   17 │ GP12 GP23│ 24
   18 │ GP13 GND │ 23
   19 │ GND  GP22│ 22
   20 │ GP14     │ 21  (GP21)
      └──────────┘
```

### Pin Modes

Pins can be configured as:

```python
from machine import Pin

# Digital OUTPUT (drive voltage)
pin = Pin(14, Pin.OUT)
pin.on()   # Set to HIGH (3.3V)
pin.off()  # Set to LOW (0V)
pin.value(1)  # Set to 1
pin.value(0)  # Set to 0

# Digital INPUT (read voltage)
pin = Pin(14, Pin.IN)
value = pin.value()  # Read 1 or 0
if pin.value() == 1:
    print("Pin is HIGH")
```

### Pico W Hardware Pin Mapping

For our weather station firmware, pins are configured in `firmware/pins.json`:

```json
{
    "scl": 7,
    "sda": 6
}
```

**What these pins do:**
- **GPIO 6 (SDA)** - I2C Serial Data (connects to BME680)
- **GPIO 7 (SCL)** - I2C Serial Clock (connects to BME680)

**Why these pins?**
- GPIO 6 and 7 support I2C hardware interface
- Dedicated hardware makes communication reliable
- User-configurable if you need different pins

---

## I2C Communication (BME680 Sensor)

### What is I2C?

**I2C** = Inter-Integrated Circuit protocol

A communication standard for connecting microcontroller to sensors:

```
Pico W                          BME680 Sensor
├─ GPIO 7 (SCL) ───────────────── SCL (Clock)
├─ GPIO 6 (SDA) ───────────────── SDA (Data)
├─ 3.3V ───────────────────────── VCC (Power)
└─ GND ────────────────────────── GND (Ground)
```

**Features:**
- **Two-wire protocol** (only need 2 data wires)
- **Synchronous** (clock signal coordinates communication)
- **Addressable** (up to 127 devices on same bus)
- **Master-Slave** (Pico is master, BME680 is slave)

### Hardware I2C on Pico W

```python
from machine import Pin, I2C

# Create I2C interface on bus 1 (using GPIO 6 and 7)
i2c = I2C(id=1,
          scl=Pin(7),        # Serial Clock on GPIO 7
          sda=Pin(6),        # Serial Data on GPIO 6
          freq=100000)       # 100 kHz standard speed
```

**What this does:**
- Configures GPIO 6 & 7 as I2C
- Sets clock speed to 100 kHz (standard for sensors)
- Creates interface object to communicate with devices

### BME680 Sensor Connection

The BME680 is an environmental sensor that measures:
- **Temperature** (in Celsius)
- **Humidity** (percent relative humidity)
- **Pressure** (atmospheric pressure in hPa)
- **Gas Resistance** (air quality indicator)

```
BME680 Pinout:
  Pin 1: VCC (3.3V) ──────────── Pico 3V3
  Pin 2: GND ─────────────────── Pico GND
  Pin 3: SCL ─────────────────── Pico GPIO 7
  Pin 4: SDA ─────────────────── Pico GPIO 6
  Pin 5: CSB (Chip Select) ───── Pico 3V3 (tied high for I2C mode)
  Pin 6: SDO (Address Select) ── Pico GND (selects address 0x77)
```

### I2C Communication Sequence

```
Step 1: Pico generates START condition
        SCL and SDA go LOW

Step 2: Pico writes device address (0x77) + read bit
        SCL clocks, SDA carries data bits

Step 3: BME680 sends ACK (acknowledgment)
        Pico reads byte

Step 4: Pico sends register address to read from
        SCL clocks, SDA carries data bits

Step 5: BME680 sends ACK

Step 6: Pico reads data from sensor
        SCL clocks, SDA carries sensor data

Step 7: Pico generates STOP condition
        SCL and SDA go HIGH
```

### Code Example: Reading Sensor Data

```python
from machine import I2C, Pin
from bme680 import BME680_I2C

# Initialize I2C
i2c = I2C(id=1, scl=Pin(7), sda=Pin(6), freq=100000)

# Create BME680 object (uses I2C address 0x77)
bme = BME680_I2C(i2c=i2c)

# Read sensor values
temperature_c = bme.temperature      # Celsius
temperature_f = temperature_c * 9/5 + 32  # Fahrenheit
humidity = bme.humidity             # Percent
pressure = bme.pressure             # hPa
gas = bme.gas                       # Ohms

print(f"Temp: {temperature_c}°C, Humidity: {humidity}%, Pressure: {pressure} hPa")
```

### Troubleshooting I2C

**Issue: "Failed 0x61"**
```
Meaning: Chip ID doesn't match (expected 0x61)
Causes:
  1. Wrong device on bus
  2. Loose wiring
  3. Wrong I2C address (0x77 vs 0x76)
  4. Power not connected
Solution:
  - Check pins.json SCL/SDA values
  - Verify wiring with multimeter
  - Check sensor address (0x77 if SDO is LOW)
```

**Issue: "No I2C device at address 0x77"**
```
Meaning: No response from sensor
Causes:
  1. Sensor not powered
  2. SCL/SDA pins wrong
  3. Pull-up resistors missing
  4. Sensor damaged
Solution:
  - Check 3.3V power to sensor
  - Verify pin configuration
  - Add 4.7k pull-up resistors if needed
```

---

## Network Sockets & WiFi

### WiFi on Pico W

The Pico W has built-in WiFi for wireless communication:

```python
import network
from time import sleep

# Create WiFi interface
wlan = network.WLAN(network.STA_IF)  # STA = Station (client) mode

# Turn on WiFi
wlan.active(True)

# Connect to network
wlan.connect("NetworkSSID", "password")

# Wait for connection
while not wlan.isconnected():
    sleep(1)

# Get IP address
print(wlan.ifconfig())  # Returns (ip, subnet, gateway, dns)
```

### Network Interface Configuration

```python
# STA_IF = Station Interface (connect to existing WiFi)
wlan = network.WLAN(network.STA_IF)

# AP_IF = Access Point Interface (create own network)
# wlan = network.WLAN(network.AP_IF)

# Get interface info
wlan.ifconfig()  # (ip, netmask, gateway, dns)
wlan.status()    # Connection status

# Disconnect
wlan.disconnect()
wlan.active(False)
```

### TCP Sockets

Sockets are how the Pico sends data to the backend server:

```python
import socket

# Create TCP socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# Set timeout (prevents hanging forever)
s.settimeout(5)  # 5 seconds

# Connect to server
s.connect(("192.168.1.100", 4430))

# Send HTTP request
request = (
    "POST /api/s2b/update HTTP/1.1\r\n"
    "Host: 192.168.1.100\r\n"
    "Content-Type: application/json\r\n"
    "Content-Length: 95\r\n"
    "Connection: close\r\n"
    "\r\n"
    '{"temperature_C": 22.5, "humidity": 45.2, ...}'
)
s.sendall(request.encode())

# Receive response
response = b""
while True:
    chunk = s.recv(1024)
    if not chunk:
        break
    response += chunk

# Close socket
s.close()
```

### Socket Methods

| Method | Purpose |
|--------|---------|
| `socket()` | Create socket |
| `connect()` | Connect to server |
| `sendall()` | Send all data |
| `recv(size)` | Receive up to size bytes |
| `close()` | Close connection |
| `settimeout()` | Set timeout |

### HTTP Request Format

The Pico sends data using HTTP POST:

```
POST /api/s2b/update HTTP/1.1
Host: 192.168.1.100
Content-Type: application/json
Content-Length: 95
Connection: close

{"temperature_C": 22.5, "temperature_F": 72.5, "humidity": 45.2, "pressure": 1013.25, "gas": 1500}
```

**What each part means:**
- `POST` - HTTP method (sending data)
- `/api/s2b/update` - Endpoint (sensor to backend)
- `HTTP/1.1` - Protocol version
- `Host:` - Server address
- `Content-Type:` - Data format (JSON)
- `Content-Length:` - Size of message body
- `Connection: close` - Close after response
- Blank line - Separator
- JSON data - Actual sensor readings

### Network Configuration in Code

```python
# In firmware/host.json
{
    "ip": "192.168.1.100",  # Backend server IP
    "port": 4430             # Backend server port
}
```

Code uses this to connect:

```python
import json

with open("host.json") as f:
    host = json.load(f)

addr = socket.getaddrinfo(host["ip"], host["port"])[0][-1]
s = socket.socket()
s.connect(addr)
```

---

## Firmware Code Interaction

### Boot Sequence

```
Power On
  ↓
Load MicroPython runtime (from flash)
  ↓
Execute firmware/main.py
  ↓
Import modules (I2C, network, socket)
  ↓
Load configuration (pins.json, host.json)
  ↓
Initialize I2C (GPIO 6 & 7)
  ↓
Initialize BME680 sensor
  ↓
Connect to WiFi
  ↓
Enter main loop (read → send → sleep)
```

### Main Loop

```python
def main():
    while True:
        # 1. Read sensor
        data = read_sensor()  # I2C communication
        
        # 2. Send to backend
        send_json(data)       # Socket communication
        
        # 3. Print for debugging
        print(data)
        
        # 4. Wait before next reading
        sleep(5)
```

### Error Handling Chain

```
read_sensor():
  try:
    Read I2C
  except OSError:
    Return error dict
    
send_json():
  for retry in range(3):
    try:
      Create socket
      Connect to backend
      Send data
      Receive response
      Parse status code
      If 200-299: success!
    except:
      Print error
      Try again
    finally:
      Close socket
```

### Hardware State Tracking

```python
# Last successful read
last_reading = 0

# Reading frequency
min_refresh_time = 1000 / refresh_rate  # milliseconds

# Check if enough time passed
if time.ticks_diff(last_reading, time.ticks_ms()) > min_refresh_time:
    # Perform reading
    last_reading = time.ticks_ms()
```

---

## Power Management

### Power Consumption

| Component | Power Draw | Notes |
|-----------|-----------|-------|
| RP2040 CPU | ~10-25 mA | Active |
| WiFi TX | ~100-200 mA | Transmitting data |
| WiFi RX | ~50-80 mA | Receiving data |
| WiFi Idle | ~10-20 mA | Connected but not transmitting |
| WiFi Off | <1 mA | Disabled |
| BME680 Sensor | ~3-5 mA | Active |
| BME680 Sleep | ~1 µA | Low power mode |

### Power Optimization Tips

**Currently: Always-On Mode**
```python
def main():
    while True:
        read_sensor()
        send_json(data)
        sleep(5)  # Still powered, just paused
```

**Power Saving: Deep Sleep**
```python
from machine import deepsleep

def main():
    read_sensor()
    send_json(data)
    deepsleep(300000)  # 300 seconds = 5 minutes
    # Pico restarts after sleep
```

**Typical Battery Life (2000 mAh battery):**
- Always-on: ~2-3 days
- Deep sleep (5 min intervals): ~30-40 days
- Deep sleep (30 min intervals): ~3-4 months

---

## Debugging & Troubleshooting

### Serial Monitor

To see firmware output, connect USB and open serial monitor:

```bash
# Windows: Use Arduino IDE, PuTTY, or miniterm
python -m serial.tools.miniterm /dev/COM3 115200

# Linux: 
miniterm.py /dev/ttyUSB0 115200

# Mac:
miniterm.py /dev/tty.usbmodem14101 115200
```

Baud rate: **115200**

### Common Boot Issues

**Issue: "Failed 0x61"**
```
Firmware hangs at startup
Cause: BME680 not responding
Solution:
  1. Check I2C wiring (GPIO 6 & 7)
  2. Check sensor power (3.3V)
  3. Verify pins.json values
  4. Check sensor address (0x77)
```

**Issue: "Failed to connect to WiFi"**
```
WiFi never connects
Causes:
  1. Wrong SSID/password in code
  2. WiFi out of range
  3. WiFi turned off
  4. Antenna issue
Solution:
  1. Update WiFi credentials
  2. Move closer to router
  3. Check antenna connection
  4. Try different WiFi band
```

**Issue: "Sending fails with HTTP error"**
```
Connection fails to backend
Causes:
  1. Wrong IP address in host.json
  2. Wrong port
  3. Backend not running
  4. Firewall blocking port
Solution:
  1. Verify IP with ipconfig
  2. Check backend port (should be 4430)
  3. Start backend with: python main.py
  4. Disable firewall or open port
```

### Memory Management

Pico W has limited RAM (264 KB):

```python
import gc

# Check memory
print(gc.mem_free())  # Free memory in bytes

# Force garbage collection
gc.collect()  # Frees unused memory

# Typical memory usage:
# MicroPython runtime: ~80 KB
# Our code: ~20 KB
# Available: ~160 KB (plenty for our use)
```

### Debugging Output

Add to firmware for troubleshooting:

```python
import time

def read_sensor():
    print("Reading sensor...")
    try:
        temp = bme.temperature
        print(f"  Temperature: {temp}°C")
        # ... more reads ...
    except OSError as e:
        print(f"Sensor error: {e}")
        return {"error": str(e)}

def send_json(data):
    print(f"Sending: {data}")
    # ... socket code ...
    print(f"Response: {status_code}")
```

### Testing I2C

```python
from machine import I2C, Pin

i2c = I2C(id=1, scl=Pin(7), sda=Pin(6))

# Scan for I2C devices
devices = i2c.scan()
print(f"Found devices: {[hex(addr) for addr in devices]}")
# Should print: Found devices: ['0x77']  (BME680 address)
```

### Testing WiFi

```python
import network

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

# Scan for networks
networks = wlan.scan()
for net in networks:
    print(f"SSID: {net[0].decode()}, Signal: {net[3]} dBm")
```

### Testing Socket Connection

```python
import socket

try:
    addr = socket.getaddrinfo("192.168.1.100", 4430)[0][-1]
    s = socket.socket()
    s.settimeout(5)
    s.connect(addr)
    print("Connected successfully!")
    s.close()
except Exception as e:
    print(f"Connection failed: {e}")
```

---

## Summary

The Pico W firmware interacts with hardware through:

1. **GPIO Pins** - Configured via pins.json
2. **I2C Bus** - Communicates with BME680 sensor
3. **Network Sockets** - Sends data via WiFi to backend
4. **Memory Management** - Handles limited RAM carefully
5. **Power Management** - Balances performance vs battery life

Key files:
- `firmware/main.py` - Main application logic
- `firmware/bme680.py` - Sensor driver (I2C communication)
- `firmware/pins.json` - GPIO configuration
- `firmware/host.json` - Backend server address

The code handles all the low-level hardware details so you can focus on reading sensors and sending data.

