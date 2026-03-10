# Database Schema

## Overview

The Raspberry Pi 4 stores weather data in a database for logging and visualization.

The database supports:

- Historical weather tracking
- Website dashboard queries
- Data analysis

## Database Choice

Possible options:

- SQLite (simple)
- PostgreSQL (scalable)

(Current choice TBD)

## Weather Data Table

Example schema:

| Field | Type | Description |
|-----|-----|-----|
| id | integer | Unique entry ID |
| timestamp | datetime | Time of reading |
| temperature | float | Temperature value |
| humidity | float | Humidity value |
| pressure | float | Atmospheric pressure |

## Example Record

|   id   |       timestamp       |  temperature  |  humidity  |  pressure  |
|:------:|:---------------------:|:-------------:|:----------:|:----------:|
|  1201  |  2026-03-10 14:22:01  |     22.3      |    41.7    |   1012.6   |


## Data Retention

The database will maintain historical data for analysis and visualization.

Possible future features:

- hourly averages
- daily summaries
- anomaly detection