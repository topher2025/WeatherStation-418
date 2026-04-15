---
title: Backend Documentation
---

# Backend Documentation (Flask API)

The backend is the "brain" of the Weather Station. It's a Python web server built with Flask that handles all the important work.

## What is Flask?

**Flask** is a lightweight Python web framework. Think of it as a tool that helps you:
- Receive requests from the internet (like "give me the latest weather")
- Process those requests 
- Send back responses (like "here's the current temperature")

## Main File: `backend/main.py`

This file contains the entire Flask application. Let's break it down into sections.

### 01. Configuration & Setup

```python
app = Flask(__name__, ...)
app.config["SECRET_KEY"] = os.getenv("WEATHER_SECRET_KEY", "...")
```

**What this does:**
- Creates a Flask application
- Sets a secret key used for encrypting session cookies (user login info)
- Configures security settings

### 02. Logging

```python
def _configure_logging() -> logging.Logger:
    # Creates log files to record what the system is doing
```

**What this does:**
- Creates a rotating log file (old logs get deleted when they get too large)
- Records all important events (logins, errors, data received, etc.)
- Helps you troubleshoot problems

### 03. Authentication System

The backend includes a complete login system:

#### Starting the System
```python
def _bootstrap_auth_accounts():
    # Reads account info from environment variable
    # Creates database entries for users
```

#### Verifying Login
```python
def _verify_credentials(username: str, password: str) -> bool:
    # Checks if username and password are correct
    # Uses hashing so passwords aren't stored in plain text
```

**How passwords work:**
- When you enter a password, it gets "hashed" (converted to a unique string)
- This hashed value is stored in the database
- When you log in again, your password is hashed and compared to the stored hash
- This way, even if someone steals the database, they can't read the passwords

#### Session Management
```python
def login_session(username, session_id):
    # Records that a user is logged in
    # Stores a unique session ID for their browser

def logout_session(username):
    # Clears the session when user logs out
```

**Sessions explained:**
- When you log in, the server creates a unique ID
- This ID is stored in a cookie in your browser
- Every request you make includes this ID
- The server checks: "Do I have a valid session for this ID?"
- If yes, you can see protected pages
- If no, you're sent to login

### 04. API Endpoints

An endpoint is like a doorbell - when someone "rings it" (makes a request), something happens.

#### Public Endpoints (No Login Required)

**POST `/api/s2b/update`** - Sensor to Backend
```python
@app.post("/api/s2b/update")
def get_current_readings():
    # Receives sensor data from the firmware device
    # Validates the data (checks if numbers are reasonable)
    # Stores in database
```

**Example data received:**
```json
{
    "temperature_C": 22.5,
    "temperature_F": 72.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "gas": 1500.0
}
```

#### Protected Endpoints (Login Required)

**GET `/api/b2f/update`** - Backend to Frontend (Latest Reading)
```python
@app.get("/api/b2f/update")
def get_latest_readings():
    # Returns the most recent weather reading
    # Frontend calls this every few seconds to update the dashboard
```

**Response example:**
```json
{
    "id": 42,
    "timestamp": "2026-04-08 15:30:00",
    "temperature": 22.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "gas_resistance": 1500.0
}
```

**GET `/api/b2f/hourly`** - Get Historical Data
```python
@app.get("/api/b2f/hourly")
def get_hourly_readings():
    # Returns weather data for the past X hours
    # Frontend uses this to show trends and graphs
```

**GET `/api/b2f/logs`** - Get System Logs
```python
@app.get("/api/b2f/logs")
def get_logs():
    # Returns the last N lines from the log file
    # Helps with debugging
```

**GET `/api/b2f/report.csv`** - Download CSV Report
```python
@app.get("/api/b2f/report.csv")
def download_weather_report_csv():
    # Generates a CSV file with weather data
    # User can open in Excel or Google Sheets
```

**GET `/api/b2f/report.pdf`** - Download PDF Report
```python
@app.get("/api/b2f/report.pdf")
def download_weather_report_pdf():
    # Generates a beautiful PDF with charts and data
    # Uses custom PDF generation code
```

### 05. Login & Logout

**GET/POST `/login`**
```python
@app.route("/login", methods=["GET", "POST"])
def login():
    # Shows login form (GET)
    # Processes login attempt (POST)
```

**Features:**
- Login attempt rate limiting (after 5 failed attempts, account is locked for 1 minute)
- Lockout time doubles each time: 1 min → 2 min → 4 min → 8 min → 15 min max
- Prevents one user from being logged in on multiple devices simultaneously

**GET/POST `/logout`**
```python
@app.route("/logout", methods=["GET", "POST"])
def logout():
    # Clears user session
    # Redirects to login page
```

### 06. Web Pages (HTML Rendering)

These endpoints return HTML pages (not data):

- **GET `/`** - Main dashboard
- **GET `/data`** - Data download page
- **GET `/history`** - Historical data viewer
- **GET `/settings`** - User settings page
- **GET `/logs`** - Log viewer page

```python
@app.get("/")
def index():
    return render_template("index.html")
```

This renders an HTML file and sends it to your browser.

### 07. Security Features

#### CORS & Session Security
```python
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,  # JavaScript can't access cookies
    SESSION_COOKIE_SECURE=True,     # Only send over HTTPS
    SESSION_COOKIE_SAMESITE="Lax"   # Prevent CSRF attacks
)
```

#### Authentication Check
```python
@app.before_request
def enforce_authentication():
    # Before ANY request, check if user is logged in
    # Skip check for login, logout, and sensor endpoints
    # For API requests without auth, return 401 Unauthorized
```

## Important Functions Explained

### `validate_payload(data)`
```python
def validate_payload(payload: dict):
    # Checks if sensor data is reasonable
    # Temperature: -40 to 85°C
    # Humidity: 0 to 100%
    # Pressure: 300 to 1100 hPa
    # Rejects if values are outside these ranges
```

This prevents bad data from entering the database.

### `_parse_report_range(raw_value)`
```python
def _parse_report_range(raw_value, default_hours=24):
    # User can request "24" hours or "all" time
    # Converts "all" to all-time data
    # Converts "24" to last 24 hours of data
```

### `_sanitize_report_hours(value)`
```python
def _sanitize_report_hours(value, default=24):
    # Ensures hours is between 1 and 168 (one week max)
    # Prevents someone from requesting gigabytes of data
```

### PDF Report Generation
```python
def _build_report_filename(range_kind, hours, extension):
    # Creates filenames like: "weather-report-24h-20260408-153000.pdf"
    # Includes timestamp so each report is unique
```

## Environment Variables

The backend reads configuration from environment variables or a `.env` file:

```
WEATHER_SECRET_KEY              # Secret key for sessions
WEATHER_API_HOST                # What IP to listen on (default: 0.0.0.0)
WEATHER_API_PORT                # What port (default: 4430)
WEATHER_AUTH_ACCOUNTS           # JSON with username/password pairs
WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS  # Session timeout (default: 15)
WEATHER_LOG_DIR                 # Where to store log files
WEATHER_LOG_LEVEL               # INFO, DEBUG, WARNING, ERROR
```

Example `.env` file:
```
WEATHER_AUTH_ACCOUNTS={"admin": "securePassword123"}
WEATHER_SECRET_KEY=my-secret-key-change-me
WEATHER_API_PORT=4430
```

## How Data Flows

```
1. Firmware device sends data to /api/s2b/update
2. Flask receives JSON data
3. validate_payload() checks if data is reasonable
4. database.insert_weather() stores in SQLite
5. Frontend calls /api/b2f/update every 5 seconds
6. Frontend displays the data
7. User can click "Download Report" to get CSV or PDF
```

## Error Handling

The backend returns standard HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 204 | Success (no content to return) |
| 400 | Bad Request (malformed JSON) |
| 401 | Unauthorized (login required) |
| 404 | Not Found (no data available) |
| 415 | Unsupported Media Type (not JSON) |
| 422 | Invalid Data (failed validation) |
| 429 | Too Many Requests (rate limited/locked out) |

## Security Best Practices Used

1. **Password Hashing** - Passwords are hashed, not stored plaintext
2. **Session Tokens** - Uses unique session IDs, not usernames
3. **Rate Limiting** - Locks account after failed login attempts
4. **HTTPS** - Uses SSL certificates for encrypted communication
5. **CSRF Protection** - Same-site cookie policy prevents cross-site attacks
6. **Input Validation** - All sensor data is validated before storage
7. **Authentication Checks** - Every protected route checks user login

## Testing the API

You can test endpoints using curl or Postman:

```bash
# Send sensor data
curl -X POST http://localhost:4430/api/s2b/update \
  -H "Content-Type: application/json" \
  -d '{"temperature_C": 22.5, "temperature_F": 72.5, "humidity": 45, "pressure": 1013.25, "gas": 1500}'

# Get latest reading
curl http://localhost:4430/api/b2f/update

# Download report
curl -o report.pdf http://localhost:4430/api/b2f/report.pdf
```

## Common Tasks

### Adding a New Endpoint

```python
@app.get("/api/custom/endpoint")
def my_endpoint():
    # This function runs when someone visits that URL
    return jsonify({"message": "Hello"})
```

### Adding a New Database Field

Edit `backend/database.py` and add a column to the CREATE TABLE statement, then run the app once to create it.

### Changing Login Requirements

Modify `enforce_authentication()` to skip new endpoints if they're public.

### Adjusting Timeout

Change `SESSION_HEARTBEAT_TIMEOUT_SECONDS` in environment or code. Lower = faster logout when inactive.

