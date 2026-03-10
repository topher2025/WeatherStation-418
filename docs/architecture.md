# System Architecture

## Overview

The weather station consists of two main systems:

1. Sensor Node (Pico W)
2. Server Node (Raspberry Pi 4)

The Pico collects environmental data and sends it wirelessly to the Pi 4, which stores and displays the information.

## High-Level Architecture

- Sensors
- Pico W
- encrypted wireless
- Pi 4 Receiver
- Database
- Web Server
- User Dashboard


## Pico W Responsibilities

- Interface with sensors
- Perform initial validation
- Package sensor readings
- Encrypt transmitted data
- Send readings via WiFi
- Operate under low-power conditions

## Raspberry Pi 4 Responsibilities

- Accept incoming connections from Pico
- Decrypt data
- Validate received packets
- Store weather data in database
- Provide API for website
- Host password-protected dashboard

## Data Flow

1. Sensors produce raw measurements
2. Pico collects and validates data
3. Pico encrypts packet
4. Pico transmits packet over WiFi
5. Pi 4 receives and decrypts packet
6. Data is validated again
7. Data is written to database
8. Website queries database for visualization

## Future Improvements

Possible future enhancements include:

- Multiple weather stations
- Long-term analytics
- Mobile dashboard