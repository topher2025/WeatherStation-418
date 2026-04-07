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

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_login_attempts_username_attempted_at
            ON login_attempts (username, attempted_at)
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS login_backoff_state (
                username TEXT PRIMARY KEY,
                failed_attempts INTEGER NOT NULL DEFAULT 0,
                lockout_until DATETIME,
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


def record_failed_login_attempt(username, max_attempts=5, base_lockout_seconds=60, max_lockout_seconds=900):
    if not username:
        return 0

    max_attempts = max(1, int(max_attempts))
    base_lockout_seconds = max(1, int(base_lockout_seconds))
    max_lockout_seconds = max(base_lockout_seconds, int(max_lockout_seconds))

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT failed_attempts
            FROM login_backoff_state
            WHERE username = ?
            LIMIT 1
            """,
            (username,),
        )
        row = cur.fetchone()

        if row is None:
            failed_attempts = 0
            cur.execute(
                """
                INSERT INTO login_backoff_state (username, failed_attempts, lockout_until)
                VALUES (?, 0, NULL)
                """,
                (username,),
            )
        else:
            failed_attempts = int(row["failed_attempts"])

        failed_attempts += 1

        lockout_seconds = 0
        if failed_attempts >= max_attempts:
            exponent = failed_attempts - max_attempts
            lockout_seconds = min(base_lockout_seconds * (2**exponent), max_lockout_seconds)
            cur.execute(
                """
                UPDATE login_backoff_state
                SET failed_attempts = ?,
                    lockout_until = datetime('now', ?),
                    updated_at = CURRENT_TIMESTAMP
                WHERE username = ?
                """,
                (failed_attempts, f"+{int(lockout_seconds)} seconds", username),
            )
        else:
            cur.execute(
                """
                UPDATE login_backoff_state
                SET failed_attempts = ?,
                    lockout_until = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE username = ?
                """,
                (failed_attempts, username),
            )

        cur.execute(
            """
            INSERT INTO login_attempts (username)
            VALUES (?)
            """,
            (username,),
        )
        cur.execute(
            """
            DELETE FROM login_attempts
            WHERE attempted_at < datetime('now', '-1 day')
            """
        )

    return int(lockout_seconds)


def get_login_lockout_seconds_remaining(username):
    if not username:
        return 0

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT CAST(strftime('%s', lockout_until) - strftime('%s', 'now') AS INTEGER) AS seconds_remaining
            FROM login_backoff_state
            WHERE username = ?
            LIMIT 1
            """,
            (username,),
        )
        row = cur.fetchone()

    if row is None or row["seconds_remaining"] is None:
        return 0

    return max(0, int(row["seconds_remaining"]))


def clear_failed_login_attempts(username):
    if not username:
        return

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            DELETE FROM login_attempts
            WHERE username = ?
            """,
            (username,),
        )
        cur.execute(
            """
            DELETE FROM login_backoff_state
            WHERE username = ?
            """,
            (username,),
        )


def is_login_rate_limited(username, max_attempts=5, window_seconds=60):
    if not username:
        return False

    if get_login_lockout_seconds_remaining(username) > 0:
        return True

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) AS attempt_count
            FROM login_attempts
            WHERE username = ?
              AND attempted_at >= datetime('now', ?)
            """,
            (username, f"-{int(window_seconds)} seconds"),
        )
        row = cur.fetchone()

    attempt_count = row["attempt_count"] if row is not None else 0
    return attempt_count >= int(max_attempts)


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
