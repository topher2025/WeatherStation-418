# Weather Station Project Overview

Welcome to the **Weather Station** project! This is a complete system for collecting, storing, and displaying weather data from physical sensors.

## What This Project Does

The Weather Station is a full-stack application that:

1. **Collects** weather measurements from a BME680 sensor
2. **Stores** this data in a database
3. **Displays** the data through a web dashboard
4. **Manages** user access with authentication
5. **Generates** weather reports in CSV and PDF formats

## Project Structure

```
WeatherStation-418/
├── backend/          # Python Flask web server (the main API)
├── frontend/         # HTML & JavaScript for the web interface
├── firmware/         # MicroPython code for the IoT device
├── docs/             # Documentation files (you are here)
├── devops/           # Docker and deployment configuration
└── security/         # Security-related configurations
```

## The Three Main Components

### 1. **Hardware (Firmware)**
- **Location**: `firmware/` folder
- **Purpose**: Runs on a MicroController (like ESP32 or similar)
- **Job**: Reads temperature, humidity, pressure, and gas readings from a BME680 sensor
- **Technology**: MicroPython (a lightweight Python for embedded devices)
- **How it works**: Collects data every 5 seconds and sends it to the backend API

### 2. **Backend (Web Server)**
- **Location**: `backend/` folder
- **Purpose**: Processes data and provides APIs
- **Technology**: Python with Flask web framework
- **Jobs**:
  - Receives sensor data from the firmware
  - Stores data in a SQLite database
  - Authenticates users (login system)
  - Provides API endpoints for the frontend
  - Generates reports

### 3. **Frontend (Web Dashboard)**
- **Location**: `frontend/` folder
- **Purpose**: Visual interface for users
- **Technology**: HTML, CSS, and JavaScript
- **Pages**:
  - Dashboard: Shows current weather and recent trends
  - History: Views historical weather data
  - Data: Download weather reports (CSV/PDF)
  - Settings: Change preferences
  - Logs: View system logs

## How It All Works Together

```
[BME680 Sensor] 
        ↓
[MicroController (firmware/main.py)]
        ↓
   Every 5 seconds sends data
        ↓
[Flask Backend API (backend/main.py)]
        ↓
   Receives data, stores in database
        ↓
[SQLite Database (weather.db)]
        ↓
[Frontend JavaScript (frontend/static/)]
        ↓
   Fetches data from API and displays it
        ↓
[User sees weather on web browser]
```

## Key Files You'll Work With

| File | Purpose |
|------|---------|
| `backend/main.py` | Main Flask application with all API endpoints |
| `backend/database.py` | Database operations (storing/retrieving weather data) |
| `frontend/index.html` | The main dashboard page |
| `frontend/static/index.js` | Dashboard JavaScript logic |
| `firmware/main.py` | Sensor reading and data transmission code |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Backend** | Python, Flask, SQLite |
| **Firmware** | MicroPython |
| **Sensor** | BME680 (Temperature, Humidity, Pressure, Gas) |

## Next Steps

- Read the [Backend Documentation](./02-backend.md) to understand the Python Flask server
- Read the [Database Documentation](./03-database.md) to learn about data storage
- Read the [Frontend Documentation](./04-frontend.md) to understand the web interface
- Read the [Firmware Documentation](./05-firmware.md) to learn about the sensor device

