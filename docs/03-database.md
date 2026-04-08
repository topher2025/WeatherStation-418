# Database Documentation

The database is where all the weather data and user information is stored. This project uses **SQLite**, a lightweight database that stores everything in a single file.

## What is SQLite?

SQLite is a simple database engine that:
- Stores data in a file (`weather.db`)
- Doesn't require a separate server
- Uses SQL (a standard language for databases)
- Is perfect for small to medium projects

## Main File: `backend/database.py`

This file contains all functions for reading and writing data.

## Database Tables

### 1. `weather_data` - Weather Readings

Stores every sensor reading from the device.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INTEGER | Unique identifier for each reading (1, 2, 3...) |
| `timestamp` | DATETIME | When the reading was taken (auto-filled with current time) |
| `temperature` | REAL | Temperature in Celsius |
| `humidity` | REAL | Humidity percentage (0-100) |
| `pressure` | REAL | Air pressure in hPa |
| `gas_resistance` | REAL | Gas sensor resistance in Ohms |

**Example data:**
```
id  | timestamp           | temperature | humidity | pressure | gas_resistance
1   | 2026-04-08 15:00   | 22.5        | 45.2     | 1013.25  | 15000.0
2   | 2026-04-08 15:05   | 22.7        | 44.8     | 1013.20  | 14500.0
3   | 2026-04-08 15:10   | 22.3        | 45.5     | 1013.30  | 15200.0
```

### 2. `users` - User Accounts

Stores login credentials and session information.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INTEGER | Unique user ID |
| `username` | TEXT | Username (unique) |
| `password_hash` | TEXT | Hashed password (not the actual password) |
| `is_active` | INTEGER | 1 = active, 0 = disabled |
| `session_id` | TEXT | Current session token (NULL if logged out) |
| `created_at` | DATETIME | When account was created |
| `updated_at` | DATETIME | When account was last modified |
| `last_heartbeat_at` | DATETIME | When user last made a request |

**Example data:**
```
id | username | password_hash              | is_active | session_id            | last_heartbeat_at
1  | admin    | pbkdf2:sha256:abc123...   | 1         | 550e8400-e29b-41d4...  | 2026-04-08 15:30
```

### 3. `login_attempts` - Failed Logins

Records every failed login attempt (used for rate limiting).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INTEGER | Unique ID |
| `username` | TEXT | Username that failed to log in |
| `attempted_at` | DATETIME | When the attempt was made |

**Why track this?**
After 5 failed attempts, the account gets locked for a time. This prevents hackers from guessing passwords.

### 4. `login_backoff_state` - Lockout Info

Stores lockout status for rate limiting.

| Column | Type | Purpose |
|--------|------|---------|
| `username` | TEXT | Username (primary key) |
| `failed_attempts` | INTEGER | How many failed attempts |
| `lockout_until` | DATETIME | When the lockout expires |
| `updated_at` | DATETIME | When this row was last updated |

**How rate limiting works:**
```
Failed Attempts | Lockout Duration
1-4             | None (can try again immediately)
5               | 60 seconds (1 minute)
6               | 120 seconds (2 minutes)
7               | 240 seconds (4 minutes)
8               | 480 seconds (8 minutes)
9+              | 900 seconds (15 minutes - max)
```

This is called "exponential backoff" - each failure doubles the wait time.

## Key Functions

### Weather Data Functions

#### `init_db()`
```python
def init_db():
    # Creates all tables if they don't exist
    # Safe to call multiple times
    # Call this once when the app starts
```

#### `insert_weather(temperature, humidity, pressure, gas_resistance)`
```python
# Store a new reading
insert_weather(22.5, 45.2, 1013.25, 15000.0)
```

**Used by:** Backend when receiving data from sensor

#### `get_latest_weather()`
```python
# Returns the most recent reading as a dictionary
data = get_latest_weather()
print(data["temperature"])  # 22.5
```

**Returns:**
```python
{
    "id": 100,
    "timestamp": "2026-04-08 15:30:00",
    "temperature": 22.5,
    "humidity": 45.2,
    "pressure": 1013.25,
    "gas_resistance": 15000.0
}
```

#### `get_hourly_weather(hours=12)`
```python
# Get all readings from the last 12 hours
data = get_hourly_weather(12)
# Returns a list of dictionaries
```

#### `get_daily_weather(days=7)`
```python
# Get readings from the last 7 days
data = get_daily_weather(7)
```

#### `get_all_weather()`
```python
# Get ALL readings ever (entire history)
data = get_all_weather()
```

#### `get_hourly_average_weather(hours=12)`
```python
# Instead of returning every reading,
# return the AVERAGE for each hour
# Useful for reducing data and making graphs cleaner

data = get_hourly_average_weather(12)
# Returns data like:
# {
#     "timestamp": "2026-04-08 15:00:00",  # Rounded to hour
#     "temperature": 22.45,  # Average of all readings that hour
#     "humidity": 45.1,
#     "pressure": 1013.24,
#     "gas_resistance": 14950.0
# }
```

**Why average?** 
If you have 12 readings per hour for 7 days, that's 12 × 24 × 7 = 2,016 data points. That's too much data to display nicely on a graph. Averaging reduces it to just 168 data points (one per hour).

#### `get_all_hourly_average_weather()`
```python
# Same as above but for all history
data = get_all_hourly_average_weather()
```

#### `get_data_point_count()`
```python
# Returns how many readings are in the database
count = get_data_point_count()
print(f"We have {count} readings")  # We have 5000 readings
```

### User & Authentication Functions

#### `upsert_user_password(username, password_hash, is_active=1)`
```python
# Create a new user OR update an existing one
from werkzeug.security import generate_password_hash

hashed = generate_password_hash("myPassword123")
upsert_user_password("alice", hashed, is_active=1)
```

**Explanation:**
- **Upsert** = "Update or Insert"
- If user exists, update their password
- If user doesn't exist, create them
- The password is hashed before storing (security!)

#### `get_user_auth(username)`
```python
# Get user info (for login)
user = get_user_auth("alice")
if user:
    print(user["username"])        # "alice"
    print(user["password_hash"])   # "pbkdf2:sha256:..."
    print(user["is_active"])       # 1
```

#### `login_session(username, session_id)`
```python
# Record that a user just logged in
import uuid
session_id = str(uuid.uuid4())
login_session("alice", session_id)
# Now alice's browser will send this session_id with each request
```

#### `logout_session(username)`
```python
# Clear the session when user logs out
logout_session("alice")
# Now alice must log in again
```

#### `is_session_active(username, session_id)`
```python
# Check if a session is still valid
if is_session_active("alice", "550e8400-e29b-41d4-a716-446655440000"):
    print("Session is valid!")
else:
    print("Session expired, please log in again")
```

#### `expire_stale_sessions(timeout_seconds=8)`
```python
# Automatically log out users who haven't done anything in X seconds
expired = expire_stale_sessions(15)  # Logout after 15 seconds of inactivity
print(f"Expired {expired} sessions")
```

#### `touch_session_heartbeat(username, session_id)`
```python
# Update the "last activity" time for a session
# Call this whenever the user makes a request
# Prevents their session from timing out
touch_session_heartbeat("alice", session_id)
```

### Rate Limiting (Login Security)

#### `record_failed_login_attempt(username, max_attempts=5, base_lockout_seconds=60, max_lockout_seconds=900)`
```python
# When someone enters wrong password
lockout_seconds = record_failed_login_attempt("alice")

if lockout_seconds > 0:
    print(f"Account locked for {lockout_seconds} seconds")
else:
    print("Try again")
```

**Returns:** How many seconds until they can try again (0 if no lockout)

#### `get_login_lockout_seconds_remaining(username)`
```python
# Check how long the lockout lasts
wait_time = get_login_lockout_seconds_remaining("alice")
if wait_time > 0:
    print(f"Please wait {wait_time} seconds before trying again")
```

#### `clear_failed_login_attempts(username)`
```python
# After successful login, reset the failure counter
clear_failed_login_attempts("alice")
```

### Utility Functions

#### `connect_db()` - Database Connection
```python
# This is a "context manager" - automatically opens and closes connections
with connect_db() as conn:
    cur = conn.cursor()
    cur.execute("SELECT * FROM weather_data LIMIT 1")
    row = cur.fetchone()
```

**Why use this pattern?**
- Automatically opens connection
- Automatically commits (saves) if no error
- Automatically rolls back if there's an error
- Automatically closes connection
- You don't have to manually manage it

#### `utc_to_local(utc_dt)`
```python
# Convert UTC time to local time zone (America/Chicago)
timestamp_utc = "2026-04-08T15:30:00Z"
local_time = utc_to_local(timestamp_utc)
print(local_time)  # 2026-04-08 10:30:00-05:00 (Chicago time)
```

**Why needed?**
- Sensor sends times in UTC (universal)
- Users want to see times in their local timezone
- This function does the conversion

## How Data Flows

```
1. Firmware sends: {"temperature_C": 22.5, "humidity": 45.2, ...}
2. Backend receives at /api/s2b/update
3. Validates with validate_payload()
4. Calls: insert_weather(22.5, 45.2, 1013.25, 15000.0)
5. Database stores in weather_data table
6. Later, frontend calls /api/b2f/update
7. Backend calls get_latest_weather()
8. Frontend receives data and displays it
```

## SQL Queries (For Advanced Users)

If you want to directly query the database:

```sql
-- Get all readings from the last 24 hours
SELECT * FROM weather_data 
WHERE timestamp >= datetime('now', '-24 hours')
ORDER BY timestamp DESC;

-- Find the highest temperature ever recorded
SELECT MAX(temperature) FROM weather_data;

-- Count how many readings per hour
SELECT 
    strftime('%Y-%m-%d %H:00', timestamp) AS hour,
    COUNT(*) AS reading_count
FROM weather_data
GROUP BY hour
ORDER BY hour DESC;

-- Check user sessions
SELECT username, session_id, last_heartbeat_at FROM users 
WHERE session_id IS NOT NULL;
```

## Tips & Best Practices

1. **Always validate input** before inserting (done in `validate_payload()`)
2. **Use transactions** (the `with connect_db()` pattern handles this)
3. **Don't store passwords in plain text** (use `generate_password_hash()`)
4. **Index important columns** (indices created for `login_attempts`)
5. **Archive old data** periodically (consider deleting data older than 1 year)

## Common Issues

**"database is locked"**
- Multiple processes trying to write at once
- SQLite isn't great for high concurrency
- Solution: Restart the app or wait a moment

**"no such table"**
- You need to call `init_db()` first
- Or the table creation failed
- Solution: Delete `weather.db` and restart

**"Can't log in even with right password"**
- Make sure `init_db()` was called
- Make sure user was created with `upsert_user_password()`
- Check that `is_active = 1`

## Database File Location

The database file is stored at:
```
backend/weather.db
```

To backup your data:
```bash
cp backend/weather.db weather.db.backup
```

To reset the database:
```bash
rm backend/weather.db
# Run the app again, it will recreate the tables
```

