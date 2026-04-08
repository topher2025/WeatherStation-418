# Quick Reference Guide

A fast lookup guide for common questions and tasks.

## Quick Links by Task

### "I want to understand what this project does"
→ Read [1-overview.md](1-overview.md) (5 minutes)

### "I want to run it locally"
→ Read [7-getting-started.md](7-getting-started.md) Section "Part 2: Running the Backend"

### "I want to understand how the web server works"
→ Read [2-backend.md](2-backend.md)

### "I want to know how data is stored"
→ Read [3-database.md](3-database.md)

### "I want to understand the web interface"
→ Read [4-frontend.md](4-frontend.md)

### "I want to set up the sensor device"
→ Read [5-firmware.md](5-firmware.md)

### "I want to understand PDF report generation"
→ Read [6-pdf-reports.md](6-pdf-reports.md)

### "I want to understand security"
→ Read [9-security.md](9-security.md)

### "I want to change something"
→ See "Common Modifications" section below

## File Location Reference

```
backend/main.py                 ← Main Flask server
backend/database.py             ← Database functions
backend/utils/report_pdf.py     ← PDF generation
frontend/index.html             ← Main dashboard
frontend/static/index.js        ← Dashboard logic
frontend/static/styles.css      ← All styling
firmware/main.py                ← Sensor code
firmware/bme680.py             ← Sensor driver
docs/                          ← You are here!
```

## Common API Endpoints

### Public Endpoints (No Login Required)

```
POST /api/s2b/update
  Purpose: Sensor sends data to backend
  Body: {"temperature_C": 22.5, "temperature_F": 72.5, "humidity": 45.2, "pressure": 1013.25, "gas": 1500.0}
  Response: 204 No Content (if successful)
```

### Protected Endpoints (Login Required)

```
GET /api/b2f/update
  Purpose: Get latest weather reading
  Response: {"id": 100, "timestamp": "...", "temperature": 22.5, ...}

GET /api/b2f/hourly?hours=24
  Purpose: Get hourly readings for past N hours
  Response: [{...}, {...}, ...]

GET /api/b2f/logs?lines=200
  Purpose: Get last N lines of log
  Response: {"lines": [...], "exists": true, "size_bytes": 1024, ...}

GET /api/b2f/report.csv?hours=24
  Purpose: Download CSV file
  Response: CSV file attachment

GET /api/b2f/report.pdf?hours=24
  Purpose: Download PDF file
  Response: PDF file attachment

POST /api/b2f/user
  Purpose: Keep session alive (heartbeat)
  Response: 204 No Content

GET /api/b2f/system-info
  Purpose: Get system status
  Response: {"firmware_version": "1.0.0", "data_points": 1000, ...}
```

### Page Endpoints

```
GET /                           → Main dashboard
GET /data                       → Data download page
GET /history                    → History viewer
GET /settings                   → User settings
GET /logs                       → System logs

GET /login                      → Show login form
POST /login                     → Process login
GET /logout                     → Logout
POST /logout                    → Logout (POST variant)
```

## Database Tables Reference

### weather_data
Stores sensor readings.

| Column | Type | Purpose |
|--------|------|---------|
| id | INTEGER | Row number |
| timestamp | DATETIME | When reading was taken |
| temperature | REAL | Temperature in °C |
| humidity | REAL | Humidity % |
| pressure | REAL | Pressure in hPa |
| gas_resistance | REAL | Gas resistance in Ohms |

**Example query:**
```sql
SELECT * FROM weather_data 
WHERE timestamp >= datetime('now', '-24 hours')
ORDER BY timestamp DESC
LIMIT 10;
```

### users
Stores user login information.

| Column | Type | Purpose |
|--------|------|---------|
| username | TEXT | User's login name |
| password_hash | TEXT | Hashed password (not plaintext) |
| is_active | INTEGER | 1=active, 0=disabled |
| session_id | TEXT | Current login session |
| last_heartbeat_at | DATETIME | Last activity time |

**Never directly set password! Use:**
```python
from werkzeug.security import generate_password_hash
hashed = generate_password_hash("mypassword")
db.upsert_user_password("username", hashed)
```

### login_attempts
Tracks failed login attempts for rate limiting.

| Column | Type | Purpose |
|--------|------|---------|
| username | TEXT | Who tried to log in |
| attempted_at | DATETIME | When they tried |

## Environment Variables

```
WEATHER_SECRET_KEY                      Secret for session encryption
WEATHER_API_HOST                        IP to listen on (default: 0.0.0.0)
WEATHER_API_PORT                        Port number (default: 4430)
WEATHER_AUTH_ACCOUNTS                   JSON: {"user": "pass", "user2": "pass2"}
WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS   Session timeout (default: 15 seconds)
WEATHER_LOG_DIR                         Where to save logs (default: backend/logs/)
WEATHER_LOG_LEVEL                       DEBUG, INFO, WARNING, ERROR
WEATHER_LOG_MAX_BYTES                   Max log file size before rotating (default: 2MB)
WEATHER_LOG_BACKUP_COUNT                How many old logs to keep (default: 5)
```

## JavaScript Console Tricks

### Check Current Weather Data
```javascript
console.log(currentWeatherData);
```

### Manually Fetch Latest Data
```javascript
fetch('/api/b2f/update')
  .then(r => r.json())
  .then(d => console.log(d));
```

### Change Theme Instantly
```javascript
applyTheme('dark');    // or 'light' or 'auto'
```

### Get User Settings
```javascript
console.log(settings);
```

### Force Update Dashboard
```javascript
fetchCurrentWeather();
fetchHistoricalData();
```

## Python Database Tricks

### Get Latest Reading
```python
import database as db
db.init_db()
latest = db.get_latest_weather()
print(f"Temperature: {latest['temperature']}°C")
```

### Add a User
```python
from werkzeug.security import generate_password_hash
import database as db

password_hash = generate_password_hash("mypassword123")
db.upsert_user_password("newuser", password_hash, is_active=1)
```

### Get All Readings from Last 7 Days
```python
import database as db
db.init_db()
data = db.get_daily_weather(7)
print(f"Got {len(data)} readings")
```

### Check How Many Data Points Exist
```python
import database as db
db.init_db()
count = db.get_data_point_count()
print(f"Database has {count} readings")
```

## Common Modifications

### Change the Port
**File:** `backend/main.py` or `.env`

In `.env`:
```
WEATHER_API_PORT=5000
```

Then restart the backend.

### Change Update Frequency
**File:** `frontend/static/index.js`

```javascript
const CONFIG = {
    updateInterval: 10000,  // 10 seconds instead of 5
    chartUpdateInterval: 10000,
};
```

### Add a New User
**File:** `backend/main.py` or manually

In `.env`:
```
WEATHER_AUTH_ACCOUNTS={"admin": "pass1", "newuser": "pass2"}
```

Restart the backend.

### Change Dark Theme Colors
**File:** `frontend/static/styles.css`

```css
:root {
    --primary-color: #3498db;           /* Blue accent */
    --background-dark: #1a1a1a;         /* Very dark background */
    --text-light: #ffffff;              /* White text */
    --card-background: #2a2a2a;         /* Card background */
}
```

### Change Light Theme Colors
```css
body.light-theme {
    --background-dark: #ffffff;         /* White background */
    --text-light: #000000;              /* Black text */
    --card-background: #f0f0f0;         /* Light gray cards */
}
```

### Change Sensor Reading Interval
**File:** `firmware/main.py`

```python
def main():
    while True:
        data = read_sensor()
        send_json(data)
        sleep(10)  # 10 seconds instead of 5
```

### Change Sensor Precision
**File:** `firmware/main.py`

```python
tempC = round(temp, 2)    # 2 decimal places
# Change to:
tempC = round(temp, 1)    # 1 decimal place
```

### Increase Session Timeout
**File:** `.env`

```
WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS=60
```

30 seconds = timeout after 30 seconds of inactivity
120 seconds = timeout after 2 minutes of inactivity

### Change PDF Appearance
**File:** `backend/utils/report_pdf.py`

Colors in `_build_chart_page_stream()`:
```python
charts = [
    {"title": "Temperature (C)", "key": "temperature", "color": "#0ea5e9"},
    {"title": "Humidity (%)", "key": "humidity", "color": "#10b981"},
    {"title": "Pressure (hPa)", "key": "pressure", "color": "#f59e0b"},
    {"title": "Gas Resistance (Ohms)", "key": "gas_resistance", "color": "#f43f5e"},
]
```

### Log Level Adjustment
**File:** `.env`

```
WEATHER_LOG_LEVEL=DEBUG    # Very detailed logging
WEATHER_LOG_LEVEL=INFO     # Normal (default)
WEATHER_LOG_LEVEL=WARNING  # Only warnings and errors
WEATHER_LOG_LEVEL=ERROR    # Only errors
```

## HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | OK | Request succeeded, returning data |
| 204 | No Content | Request succeeded, no data to return |
| 400 | Bad Request | Malformed JSON or missing fields |
| 401 | Unauthorized | Not logged in or session expired |
| 404 | Not Found | No data available or endpoint doesn't exist |
| 409 | Conflict | Account logged in elsewhere |
| 415 | Unsupported Media Type | Sent data that wasn't JSON |
| 422 | Unprocessable Entity | Data failed validation (invalid ranges) |
| 429 | Too Many Requests | Too many login attempts (rate limited) |
| 500 | Internal Server Error | Backend crashed |

## Troubleshooting Quick Reference

| Problem | Check These |
|---------|-------------|
| "Port in use" | Change WEATHER_API_PORT in .env |
| "Can't log in" | Check WEATHER_AUTH_ACCOUNTS in .env |
| "No data on dashboard" | 1) Logged in? 2) Sent test data? 3) No errors in console? |
| "Certificate warning" | Normal for self-signed cert, click "Advanced" → "Continue" |
| "Database locked" | Restart backend |
| "Sensor not reading" | Check pins.json GPIO pins and wiring |
| "WiFi won't connect" | Check SSID, password, and network range in firmware |
| "API call fails" | Check backend is running on correct IP/port |
| "PDF won't download" | Check backend log for errors |
| "Theme won't change" | Clear browser cache, hard refresh (Ctrl+Shift+R) |

## Performance Metrics

```
Current Values:
- Sensor read time:           ~10ms
- Network send time:          ~100-500ms
- Dashboard update:           Every 5 seconds
- Database query (latest):    <10ms
- PDF generation (24h data):  ~1-2 seconds
- Data per reading:           ~100 bytes
- Data per day:               ~2.88 MB (at 5-minute intervals)
- Data per year:              ~1.05 GB
```

## Security Checklist

- [ ] Changed default password from "password123"
- [ ] Set strong WEATHER_SECRET_KEY (not "dev-secret-change-me")
- [ ] Using HTTPS (SSL certificates enabled)
- [ ] Regular backups of weather.db
- [ ] Only admin can access settings
- [ ] Session timeouts configured appropriately
- [ ] Log files are being created
- [ ] No sensitive data in version control

## File Size Reference

```
Typical Sizes:
- weather.db (empty):         ~16 KB
- weather.db (1 year data):   ~1 GB
- styles.css:                 ~20 KB
- index.js:                   ~15 KB
- PDF (24h data):             ~50 KB
- PDF (7 days):               ~150 KB
- PDF (30 days):              ~300 KB
- Log file:                   Rotating, max 10 MB
```

## Command Line Cheat Sheet

```bash
# Start backend
cd backend && python main.py

# Test API (Linux/Mac)
curl -X POST https://localhost:4430/api/s2b/update -H "Content-Type: application/json" -d '{"temperature_C":22.5,"temperature_F":72.5,"humidity":45,"pressure":1013.25,"gas":1500}' -k

# Check logs
tail -f backend/logs/weatherstation.log

# Reset database
rm backend/weather.db

# View Python version
python --version

# List processes using port 4430
lsof -i :4430  # Mac/Linux
netstat -ano | findstr :4430  # Windows

# Kill process using port 4430
kill -9 PID  # Mac/Linux
taskkill /PID PID /F  # Windows
```

## Browser Keyboard Shortcuts

```
F12                 → Open Developer Tools
Ctrl+Shift+R        → Hard refresh (clear cache)
Ctrl+Shift+Delete   → Clear browser data
Ctrl+I              → Inspect element
Ctrl+J              → Open console
Ctrl+Shift+N        → New private window (for testing)
```

## Next Steps

1. **Start small** - Run backend locally first
2. **Test with fake data** - Send test readings before using real sensor
3. **Read the relevant documentation** - Click links at top of this page
4. **Explore the code** - Look at actual source files
5. **Make changes** - Start with styling (CSS) before logic (Python/JS)
6. **Review security** - Read [9-security.md](9-security.md) before production deployment
7. **Ask questions** - Check documentation before assuming something is broken

Good luck! 🚀



