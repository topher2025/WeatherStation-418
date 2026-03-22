import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime

DB_PATH = Path("weather.db")


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

        cur.execute("""
            CREATE TABLE IF NOT EXISTS weather_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                temperature REAL,
                humidity REAL,
                pressure REAL,
                gas_resistance REAL
            )
            """)


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

        cur.execute("""
            SELECT * FROM weather_data
            ORDER BY id DESC
            LIMIT 1
            """)

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

        cur.execute("""
            SELECT * FROM weather_data
            ORDER BY timestamp ASC
            """)

        rows = cur.fetchall()

    return [dict(row) for row in rows]


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
