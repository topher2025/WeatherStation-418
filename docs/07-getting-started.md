---
title: Getting Started Guide
---

# Getting Started Guide

This guide will help you understand and set up the Weather Station project from scratch.

## Prerequisites

Before you start, you need:

### For Development (Understanding the Code)
- Basic Python knowledge (variables, functions, if/else)
- Basic JavaScript knowledge (functions, fetch API)
- Web browser (Chrome, Firefox, etc.)
- Text editor (VS Code, PyCharm, Sublime Text)

### For Running the Backend
- Python 3.8 or later
- Windows, macOS, or Linux
- Terminal/Command Prompt knowledge

### For Running the Hardware
- Microcontroller (ESP32 or ESP8266)
- BME680 sensor
- USB cable
- WiFi network
- MicroPython firmware flashed to the device

### For Running Without Hardware
- Python 3.8 or later
- Docker (optional, if you want the devops container path)
- The simulator entrypoint at `devops/firmware/firmware-main.py`

## Project Overview (Quick Version)

```
Physical Sensor (Firmware)
         ↓ (sends data every 5 seconds)
    Web Server (Backend - Python Flask)
         ↓ (stores data, provides API)
    Database (SQLite)
         ↓ (queries data)
   Web Browser (Frontend - HTML/JS)
         ↓ (displays information)
    User sees weather data
```

If you do not have a flashed board, you can swap in the devops simulator (`devops/firmware/firmware-main.py`) which sends the same API payloads using generated readings.

## Part 1: Understanding the Code Structure

### Backend Files to Know

```
backend/
├── main.py              ← Flask web server (THE MAIN FILE)
├── database.py          ← Database operations
├── requirements.txt     ← Python dependencies
└── utils/
    └── report_pdf.py    ← PDF generation
```

**What each does:**
- `main.py` - Receives sensor data, provides API, handles login
- `database.py` - Stores/retrieves weather data and user info
- `report_pdf.py` - Creates PDF reports with charts

### Frontend Files to Know

```
frontend/
├── index.html           ← Main dashboard
├── login.html          ← Login page
├── data.html           ← Download reports
├── history.html        ← View past data
├── settings.html       ← User settings
├── logs.html           ← System logs
└── static/
    ├── styles.css      ← All styling
    ├── index.js        ← Dashboard logic
    ├── data.js         ← Download page logic
    ├── history.js      ← History page logic
    ├── settings.js     ← Settings logic
    ├── logs.js         ← Logs page logic
    └── logout.js       ← Logout handler
```

### Firmware Files to Know

```
firmware/
├── main.py             ← Sensor reading & sending
├── bme680.py          ← BME680 driver
├── pins.json          ← GPIO pin configuration
└── host.json          ← Backend server address
```

For containerized or local testing without hardware, use:

```
devops/firmware/
└── firmware-main.py    ← Simulated sensor readings and API posting
```

## Part 2: Running the Backend Locally

### Step 1: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**What gets installed:**
- Flask - Web framework
- Werkzeug - Security utilities
- pytz - Timezone handling
- Pillow, matplotlib - For image/chart generation

### Step 2: Set Up Environment Variables

Create a `.env` file in the `backend` folder:

```
WEATHER_SECRET_KEY=my-secret-key-change-me
WEATHER_AUTH_ACCOUNTS={"admin": "password123", "guest": "guest123"}
WEATHER_API_PORT=4430
WEATHER_LOG_LEVEL=INFO
```

**What these do:**
- `SECRET_KEY` - Used to encrypt session cookies
- `AUTH_ACCOUNTS` - Username/password pairs (JSON format)
- `API_PORT` - What port to run on (4430 is default for HTTPS)
- `LOG_LEVEL` - How much logging (DEBUG, INFO, WARNING, ERROR)

### Step 3: Run the Server

```bash
cd backend
python main.py
```

**Expected output:**
```
Starting WeatherStation backend on 0.0.0.0:4430
Running on https://127.0.0.1:4430/
```

### Step 4: Access the Dashboard

Open your browser:
```
https://localhost:4430/
```

**Note:** You'll get a certificate warning (HTTPS uses self-signed cert). Click "Advanced" and "Proceed anyway".

### Step 5: Log In

Username: `admin`
Password: `password123`

You should see a dashboard, but no weather data yet.

## Part 3: Testing the Backend API

Without the hardware, you can manually send data:

If you want a more realistic test loop, run the devops simulator instead of sending one-off requests. It reads `host.json`, honors `WEATHER_API_HOST` / `WEATHER_API_PORT`, and posts random readings every 5 seconds.

### Using Python (from another terminal)

```python
import requests
import json

data = {
    "temperature_C": 22.5,
    "temperature_F": 72.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "gas": 1500.0
}

response = requests.post(
    "https://localhost:4430/api/s2b/update",
    json=data,
    verify=False  # Ignore certificate warning
)

print(response.status_code)  # Should be 204 (success)
```

### Using curl (from terminal)

```bash
curl -X POST https://localhost:4430/api/s2b/update \
  -H "Content-Type: application/json" \
  -d '{"temperature_C": 22.5, "temperature_F": 72.5, "humidity": 45, "pressure": 1013.25, "gas": 1500}' \
  -k  # Ignore certificate warning
```

### Using Postman

1. Download Postman (free)
2. Create new POST request
3. URL: `https://localhost:4430/api/s2b/update`
4. Body (JSON):
   ```json
   {
       "temperature_C": 22.5,
       "temperature_F": 72.5,
       "humidity": 45.2,
       "pressure": 1013.25,
       "gas": 1500.0
   }
   ```
5. Send

If successful (204 response), refresh the dashboard - you should see data!

## Part 4: Understanding Data Flow

### Step 1: Hardware Sends Data
```
BME680 Sensor → Microcontroller → WiFi → Backend Server
```

**What happens:**
- Sensor measures: temperature, humidity, pressure, gas
- Microcontroller collects and formats as JSON
- Sends HTTP POST to backend API

### Step 2: Backend Processes Data
```
API Endpoint (/api/s2b/update)
  ↓
Validate data (checks if numbers are reasonable)
  ↓
Store in database (weather_data table)
  ↓
Return 204 (success)
```

### Step 3: Frontend Fetches Data
```
Browser JavaScript (every 5 seconds)
  ↓
Fetch /api/b2f/update (latest reading)
Fetch /api/b2f/hourly (past 24 hours)
  ↓
Parse JSON response
  ↓
Update HTML elements with new values
  ↓
User sees updated dashboard
```

### Step 4: User Downloads Report
```
User clicks "Download PDF"
  ↓
Frontend sends: GET /api/b2f/report.pdf
  ↓
Backend:
  - Queries database for data
  - Calculates statistics (min/max/avg)
  - Generates PDF with charts
  ↓
Browser shows "Save As" dialog
  ↓
User saves PDF file
```

## Part 5: Key Concepts Explained

### What is REST API?

REST = Representable State Transfer

Simple definition: URLs that do different things based on HTTP method.

```
GET /api/b2f/update         → Retrieve latest reading
GET /api/b2f/hourly         → Retrieve historical data
GET /api/b2f/report.csv     → Download CSV file
GET /api/b2f/report.pdf     → Download PDF file
POST /api/s2b/update        → Send sensor data
POST /login                 → Authenticate user
```

### What is JSON?

JSON = JavaScript Object Notation

It's a way to format data so both Python and JavaScript can read it.

```json
{
    "temperature": 22.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "timestamp": "2026-04-08 15:30:00"
}
```

**Rules:**
- Strings use double quotes
- Numbers don't need quotes
- Objects use curly braces `{}`
- Arrays use square brackets `[]`

### What is SQLite?

SQLite is a database in a single file (`weather.db`).

**Concepts:**
- **Table** - Like a spreadsheet with rows and columns
- **Row** - One record (one sensor reading)
- **Column** - One field (temperature, humidity, etc.)
- **Query** - A request for data

**Example:**
```sql
SELECT temperature, humidity FROM weather_data
WHERE timestamp >= datetime('now', '-24 hours')
ORDER BY timestamp DESC;
```

Means: "Get temperature and humidity from the last 24 hours, show newest first"

### What is Session/Authentication?

**Without sessions:**
```
User: "Show me my data!"
Server: "Who are you? Could be anyone!"
User: "I'm Alice"
Server: "How do I know you're Alice?"
```

**With sessions:**
```
User: Logs in with username/password
Server: Creates a unique token (session ID)
User: Stores token in browser cookie
User: "Show me data" (includes cookie)
Server: "Hi Alice, I recognize your token!"
```

**The project uses this flow:**
1. User enters username/password on login page
2. Backend verifies password
3. Backend creates session (unique ID)
4. Session stored in browser cookie
5. Every request includes the cookie
6. Backend validates cookie before returning data

## Part 6: Common Tasks

### Adding Debug Output

In `backend/main.py`:

```python
logger.info("This is logged")          # Will appear in logs
print("Debug info", some_variable)     # Appears in terminal
```

### Viewing Logs

```bash
# Watch logs in real-time
tail -f backend/logs/weatherstation.log

# On Windows PowerShell
Get-Content backend/logs/weatherstation.log -Wait
```

### Changing Login Timeout

In `backend/main.py`, find:

```python
SESSION_HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS", "15"))
```

Change `"15"` to desired seconds (e.g., `"60"` for 1 minute).

### Changing Sample Data

To stop at a specific time with no new data:

```python
# In the loop that keeps asking for new data
if datetime.now().hour >= 17:  # Stop at 5 PM
    break
```

### Resetting All Data

```bash
# Delete the database
rm backend/weather.db

# Restart the app
python backend/main.py
# It automatically recreates the database
```

## Part 7: Debugging Tips

### 01. Check Logs
```bash
cat backend/logs/weatherstation.log
```

### 02. Test API Manually
Use curl or Postman to test endpoints.

### 03. Browser Console
Press F12 in your browser, go to "Console" tab to see JavaScript errors.

### 04. Check Database
```python
import sqlite3
conn = sqlite3.connect('backend/weather.db')
cursor = conn.cursor()
cursor.execute("SELECT * FROM weather_data LIMIT 5")
print(cursor.fetchall())
```

### 05. Enable Debug Logging
In `.env`:
```
WEATHER_LOG_LEVEL=DEBUG
```

## Next Steps

1. **Read the documentation:**
   - Overview.md - Big picture
   - Backend.md - Flask server details
   - Database.md - Data storage
   - Frontend.md - Web interface
   - Firmware.md - Sensor code

2. **Set up the hardware:**
   - Flash MicroPython to microcontroller
   - Wire up BME680 sensor
   - Update pins.json with your GPIO pins
   - Update host.json with your backend IP

3. **Customize:**
   - Change colors in styles.css
   - Add new API endpoints
   - Modify database schema
   - Create new pages

## Troubleshooting

**"Port 4430 already in use"**
- Another app is using that port
- Change `WEATHER_API_PORT` in `.env`
- Or kill the process using port 4430

**"Certificate warning in browser"**
- Normal - using self-signed cert for HTTPS
- Click "Advanced" → "Proceed anyway"
- For production, use proper SSL certificate

**"No data appearing on dashboard"**
- Backend running?
- Logged in?
- Sent test data?
- Check browser console (F12) for errors

**"Can't log in"**
- Check username/password in `.env`
- Make sure WEATHER_AUTH_ACCOUNTS is valid JSON
- Restart backend after changing `.env`

**"Database locked"**
- Multiple processes accessing database
- Restart backend

## Security Notes

⚠️ **This is for development/learning only!**

For production, you need:
1. ✅ Real SSL certificate (not self-signed)
2. ✅ Strong passwords (not "password123")
3. ✅ Database backups
4. ✅ Rate limiting on login
5. ✅ HTTPS enforcement
6. ✅ Regular security updates

## Resources

- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [HTML/CSS/JS Tutorial](https://www.w3schools.com/)
- [MicroPython Documentation](https://docs.micropython.org/)

## Getting Help

1. Check the relevant documentation file (1-6)
2. Look at the code comments in the source files
3. Search for error messages in documentation
4. Check browser console for JavaScript errors
5. Look at server logs for backend errors

Happy coding! 🌦️

