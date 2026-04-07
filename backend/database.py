import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime

DB_PATH = Path("weather.db")
_USER_COLUMNS_READY = False


# Connect to database
@contextmanager
def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets you access columns by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# Initialize database (create table if not exists)
def init_db():
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS weather_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                temperature REAL,
                humidity REAL,
                pressure REAL,
                gas_resistance REAL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                session_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    _ensure_user_columns()


def _ensure_user_columns():
    global _USER_COLUMNS_READY
    if _USER_COLUMNS_READY:
        return

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(users)")
        existing_columns = {row["name"] for row in cur.fetchall()}

        if "last_heartbeat_at" not in existing_columns:
            cur.execute("ALTER TABLE users ADD COLUMN last_heartbeat_at DATETIME")

    _USER_COLUMNS_READY = True


# Insert weather data
def insert_weather(temperature, humidity, pressure, gas_resistance):
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO weather_data (temperature, humidity, pressure, gas_resistance)
            VALUES (?, ?, ?, ?)
            """,
            (temperature, humidity, pressure, gas_resistance),
        )


# Get latest weather entry
def get_latest_weather():
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT * FROM weather_data
            ORDER BY id DESC
            LIMIT 1
            """
        )

        row = cur.fetchone()

    if row is None:
        return None

    return dict(row)  # convert to JSON-friendly dict


def get_hourly_weather(hours=12):
    try:
        hours = abs(int(hours))
    except (TypeError, ValueError):
        hours = 12

    if hours < 1:
        hours = 1

    interval = f"-{hours} hours"

    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT * FROM weather_data
            WHERE timestamp >= datetime('now', ?)
            ORDER BY timestamp ASC
            """,
            (interval,),
        )

        rows = cur.fetchall()

    return [dict(row) for row in rows]


def get_daily_weather(days=7):
    try:
        days = abs(int(days))
    except (TypeError, ValueError):
        days = 7

    interval = f"-{days} days"

    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT * FROM weather_data
            WHERE timestamp >= datetime('now', ?)
            ORDER BY timestamp ASC
            """,
            (interval,),
        )

        rows = cur.fetchall()

    return [dict(row) for row in rows]


def get_weekly_weather(weeks=4):
    try:
        weeks = abs(int(weeks))
    except (TypeError, ValueError):
        weeks = 4
    return get_daily_weather(weeks * 7)


def get_all_weather():
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT * FROM weather_data
            ORDER BY timestamp ASC
            """
        )

        rows = cur.fetchall()

    return [dict(row) for row in rows]


def get_hourly_average_weather(hours=12):
    try:
        hours = abs(int(hours))
    except (TypeError, ValueError):
        hours = 12

    if hours < 1:
        hours = 1

    interval = f"-{hours} hours"

    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT
                strftime('%Y-%m-%d %H:00:00', timestamp) AS timestamp,
                AVG(temperature) AS temperature,
                AVG(humidity) AS humidity,
                AVG(pressure) AS pressure,
                AVG(gas_resistance) AS gas_resistance
            FROM weather_data
            WHERE timestamp >= datetime('now', ?)
            GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
            ORDER BY timestamp ASC
            """,
            (interval,),
        )

        rows = cur.fetchall()

    return [dict(row) for row in rows]


def get_all_hourly_average_weather():
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute("""
            SELECT
                strftime('%Y-%m-%d %H:00:00', timestamp) AS timestamp,
                AVG(temperature) AS temperature,
                AVG(humidity) AS humidity,
                AVG(pressure) AS pressure,
                AVG(gas_resistance) AS gas_resistance
            FROM weather_data
            GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
            ORDER BY timestamp ASC
            """)

        rows = cur.fetchall()

    return [dict(row) for row in rows]


def get_data_point_count():
    """Get the total count of data points in the database"""
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT COUNT(*) as count FROM weather_data
            """
        )

        row = cur.fetchone()

    return row["count"] if row else 0


def create_user_if_missing(username, password_hash, is_active=1):
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO users (username, password_hash, is_active, session_id)
            VALUES (?, ?, ?, NULL)
            ON CONFLICT(username) DO NOTHING
            """,
            (username, password_hash, is_active),
        )
        return cur.rowcount == 1


def upsert_user_password(username, password_hash, is_active=1):
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO users (username, password_hash, is_active, session_id)
            VALUES (?, ?, ?, NULL)
            ON CONFLICT(username) DO UPDATE SET
                password_hash=excluded.password_hash,
                is_active=excluded.is_active,
                updated_at=CURRENT_TIMESTAMP
            """,
            (username, password_hash, is_active),
        )


def get_user_auth(username):
    with connect_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT id, username, password_hash, is_active
            FROM users
            WHERE username = ?
            LIMIT 1
            """,
            (username,),
        )

        row = cur.fetchone()

    if row is None:
        return None

    return dict(row)


def login_session(username, session_id):
    """Mark user as logged in with given session ID"""
    _ensure_user_columns()
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE users
            SET session_id = ?,
                last_heartbeat_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
            """,
            (session_id, username),
        )


def logout_session(username):
    """Mark user as logged out by clearing session ID"""
    _ensure_user_columns()
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE users
            SET session_id = NULL,
                last_heartbeat_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
            """,
            (username,),
        )


def is_user_logged_in_elsewhere(username, current_session_id):
    """Check if user is already logged in on a different session"""
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT session_id FROM users
            WHERE username = ?
            LIMIT 1
            """,
            (username,),
        )
        row = cur.fetchone()

    if row is None:
        return False

    stored_session_id = row["session_id"]
    if stored_session_id is None:
        return False
    return stored_session_id != current_session_id


def expire_stale_sessions(timeout_seconds=8):
    """Clear sessions with no heartbeat inside timeout window."""
    _ensure_user_columns()
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE users
            SET session_id = NULL,
                last_heartbeat_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id IS NOT NULL
              AND (
                  last_heartbeat_at IS NULL
                  OR last_heartbeat_at <= datetime('now', ?)
              )
            """,
            (f"-{int(timeout_seconds)} seconds",),
        )
        return cur.rowcount


def touch_session_heartbeat(username, session_id):
    """Refresh heartbeat timestamp for an active session."""
    _ensure_user_columns()
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE users
            SET last_heartbeat_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
              AND session_id = ?
            """,
            (username, session_id),
        )
        return cur.rowcount > 0


def get_user_session_id(username):
    """Return the currently stored session id for a user."""
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT session_id FROM users
            WHERE username = ?
            LIMIT 1
            """,
            (username,),
        )
        row = cur.fetchone()

    if row is None:
        return None

    return row["session_id"]


def is_session_active(username, session_id):
    """True when the provided session id matches the active DB session."""
    if not username or not session_id:
        return False

    stored_session_id = get_user_session_id(username)
    return stored_session_id is not None and stored_session_id == session_id


def utc_to_local(utc_dt):
    import pytz

    if isinstance(utc_dt, str):
        parsed = datetime.fromisoformat(utc_dt.strip().replace("Z", "+00:00"))
    elif isinstance(utc_dt, datetime):
        parsed = utc_dt
    else:
        raise TypeError("utc_to_local expected datetime or str input")

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=pytz.utc)
    else:
        parsed = parsed.astimezone(pytz.utc)

    return parsed.astimezone(pytz.timezone("America/Chicago"))
