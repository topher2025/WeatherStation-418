# System Architecture - Updated

## Project Overview

The Weather Station is a complete IoT system for monitoring environmental conditions. It consists of three main layers:

```
┌──────────────────────────────────────────────────────┐
│          Frontend (Web Dashboard)                    │
│    - HTML/CSS/JavaScript                             │
│    - Real-time data display                          │
│    - PDF/CSV reports                                 │
│    - User settings                                   │
└────────────┬─────────────────────────────────────────┘
             │ HTTPS
┌────────────▼─────────────────────────────────────────┐
│          Backend (Flask API Server)                  │
│    - Authentication & Authorization                  │
│    - REST API endpoints                              │
│    - Session management                              │
│    - Data validation                                 │
│    - Report generation                               │
└────────────┬─────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────┐
│          Database (SQLite)                           │
│    - Weather data (temperature, humidity, etc)       │
│    - User accounts & sessions                        │
│    - Login attempt tracking                          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│          Firmware (Microcontroller)                  │
│    - BME680 sensor interface                         │
│    - WiFi communication                              │
│    - HTTPS data transmission                         │
│    - Data validation                                 │
└────────────┬─────────────────────────────────────────┘
             │ HTTPS (over WiFi)
             └──► Backend API (POST /api/s2b/update)
```

## Historical Note

The original architecture plan mentioned:
- Sensor Node (Pico W) - now uses microcontroller
- Server Node (Raspberry Pi 4) - now runs on any system

Current implementation runs on ESP32/ESP8266 and standard Python servers (Windows, Linux, macOS).

## Component Responsibilities

### Frontend (Web Browser)
- Render HTML pages
- Fetch data via HTTPS
- Display real-time updates
- Manage user preferences
- Download reports

### Backend (Flask Server)
- Authenticate users
- Manage sessions
- Validate sensor data
- Store in database
- Generate reports
- Serve API endpoints
- Host web pages

### Database (SQLite)
- Store weather readings
- Manage user accounts
- Track sessions
- Log login attempts
- Implement rate limiting

### Firmware (Microcontroller)
- Read BME680 sensor
- Format data as JSON
- Validate locally
- Send via HTTPS
- Handle network errors
- Retry on failure

## Data Flow

```
1. Sensor produces measurement
   ↓
2. Microcontroller reads sensor
   ↓
3. Validates ranges (temp -40 to 85°C, humidity 0-100%, etc)
   ↓
4. Formats as JSON
   ↓
5. Sends HTTPS POST to /api/s2b/update (retry 3x if needed)
   ↓
6. Backend receives at /api/s2b/update endpoint
   ↓
7. Validates again (range check, type check)
   ↓
8. Stores in SQLite database
   ↓
9. Frontend polls /api/b2f/update every 5 seconds
   ↓
10. Browser receives JSON
   ↓
11. JavaScript updates display
   ↓
12. User sees updated weather data
```

## Security Architecture

See [09-security.md](09-security.md) for detailed security information.

Key security layers:
- HTTPS encryption (all network communication)
- Password hashing (PBKDF2 + salt)
- Session management (UUID tokens, HTTPOnly cookies)
- Input validation (strict range checking)
- Rate limiting (exponential backoff on failed login)
- Database security (parameterized queries)

## Scalability Notes

Current design handles:
- 1 sensor device → 1 backend server
- Unlimited users (per browser)
- 1-2 MB data per year
- ~2000 readings per hour maximum

For multiple sensors:
- Add multiple firmware devices with unique identifiers
- Backend routes to correct database
- Frontend aggregates data

## Technology Stack Details

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | HTML5 / CSS3 | - | Responsive design |
| Frontend | JavaScript ES6 | - | Vanilla JS, no frameworks |
| Backend | Python | 3.8+ | Flask, Werkzeug |
| Backend | Flask | 3.1.3+ | Web framework |
| Database | SQLite3 | 3.x | Single-file database |
| Firmware | MicroPython | 1.x | Lightweight Python |
| Comms | HTTPS/TLS | 1.2+ | Secure encrypted transport |
| Sensor | BME680 | - | I2C interface |
| Microcontroller | ESP32/ESP8266 | - | Built-in WiFi |

## Design Principles

1. **Security First** - Every layer validates input
2. **Simplicity** - No complex frameworks or dependencies
3. **Reliability** - Retry logic, error handling, timeouts
4. **Transparency** - Well-documented, readable code
5. **Educational** - Written to teach concepts

## Deployment Options

### Local Development
```
Computer running:
- Flask backend (localhost:4430)
- Firefox/Chrome frontend
- SQLite database (local file)
- Optional: Firmware simulator
```

### Home Network
```
Raspberry Pi / NUC running:
- Flask backend (192.168.1.x:4430)
- ESP32 device sending data
- Browser on any device on network
```

### Cloud (Future)
```
Cloud server (AWS/Google Cloud) running:
- Flask backend
- Real SSL certificates
- Multiple sensor devices
- Many users
```

## See Also

- [01-overview.md](01-overview.md) - Quick project overview
- [02-backend.md](02-backend.md) - Backend detailed documentation
- [05-firmware.md](05-firmware.md) - Firmware detailed documentation
- [11-hardware.md](11-hardware.md) - Pico W hardware and code interaction
- [09-security.md](09-security.md) - Complete security documentation
