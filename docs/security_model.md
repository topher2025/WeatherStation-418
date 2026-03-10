# Security Model

## Overview

Cybersecurity protections are incorporated throughout the system lifecycle.

Security measures protect:

- transmitted weather data
- server access
- stored data

## Wireless Security

Weather data transmission will use:

- encrypted communication
- secure WiFi connection
- validated packet structure

## Website Authentication

The weather dashboard will be password protected.

Security features include:

- rotating password every 12 hours
- limited simultaneous connections
- authentication before viewing data

## Access Control

The server will restrict connections to a maximum of five users simultaneously.

Additional protections may include:

- IP logging
- connection timeouts
- rate limiting

## Data Integrity

Incoming data must be validated before entering the database.

Validation includes:

- type checking
- acceptable value ranges
- checksum verification

## Secure Development

Security considerations will be included during:

- design
- implementation
- testing
- deployment