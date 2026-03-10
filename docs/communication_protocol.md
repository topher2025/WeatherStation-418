# Communication Protocol

## Overview

The Pico W sends weather data to the Raspberry Pi 4 over a wireless network. Data is encrypted and transmitted using a simple packet format.

## Transmission Method

Possible communication methods:

- HTTP POST
- TCP socket
- MQTT

(Current implementation TBD)

## Packet Structure

Example packet structure:
```json
{
"timestamp": "...",
"temperature": "...",
"humidity": "...",
"pressure": "...",
"checksum": "..."
}
```


## Encryption

Data must be encrypted before transmission to prevent interception or tampering.

Possible encryption methods:

- AES
- TLS
- Secure WiFi connection

(Final method TBD)

## Data Validation

Both the Pico and Pi will validate data.

Validation includes:

- Range checks
- Timestamp verification
- Packet integrity checks

## Error Handling

Possible errors include:

- Lost packets
- Corrupted data
- Network disconnects

The system should:

- Retry transmissions
- Log failures
- Ignore malformed packets