# Raspberry Pi Weather Station

## Overview

This project implements a solar-powered weather station using a **Raspberry Pi Pico W** and a **Raspberry Pi 4**. The system collects weather data from sensors, transmits it securely over WiFi, stores it in a database, and displays it through a web interface.

The project is part of an engineering design lifecycle including requirements, design, implementation, testing, and documentation.

## System Components

### Pico W (Sensor Node)

Responsibilities:

- Read sensor data
- Perform basic data validation
- Encrypt weather data
- Transmit data wirelessly
- Operate using solar and battery power

### Raspberry Pi 4 (Server)

Responsibilities:

- Receive encrypted data
- Validate and store readings
- Log data in a database
- Host a website dashboard
- Manage authentication and access control

## Key Features

- Solar powered operation
- Wireless encrypted data transmission
- Weatherproof housing
- Data logging and visualization
- Password-protected web interface
- Rotating password system
- Limited simultaneous connections

## Documentation

See the sidebar for detailed documentation on:

- System architecture
- Communication protocol
- Database design
- Security model

## Contributors

| Role | Name |
|-----|-----|
| Project Manager | |
| Software Lead | |
| Hardware Lead | |
| Cybersecurity Lead | |