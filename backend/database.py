import sqlite3
from pathlib import Path

DB_PATH = Path("weather.db")


# Connect to database
def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets you access columns by name
    return conn


# Initialize database (create table if not exists)
def init_db():
    conn = connect_db()
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

    conn.commit()
    conn.close()


# Insert weather data
def insert_weather(temperature, humidity, pressure, gas_resistance):
    conn = connect_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO weather_data (temperature, humidity, pressure, gas_resistance)
        VALUES (?, ?, ?, ?)
    """, (temperature, humidity, pressure, gas_resistance))

    conn.commit()
    conn.close()


# Get latest weather entry
def get_latest_weather():
    conn = connect_db()
    cur = conn.cursor()

    cur.execute("""
                SELECT * FROM weather_data
                ORDER BY id DESC
                LIMIT 1
                """)

    row = cur.fetchone()
    conn.close()

    if row is None:
        return None

    return dict(row)  # convert to JSON-friendly dict


def get_hourly_weather(hours=12):
    conn = connect_db()
    cur = conn.cursor()

    try:
        hours = int(hours)
    except (TypeError, ValueError):
        hours = 12

    if hours < 1:
        hours = 1

    interval = f"-{hours} hours"

    cur.execute(
        """
        SELECT * FROM weather_data
        WHERE timestamp >= datetime('now', ?)
        ORDER BY timestamp ASC
        """,
        (interval,),
    )

    rows = cur.fetchall()
    conn.close()

    return [dict(row) for row in rows]
