# WeatherStation-418

## Local setup
- Copy `.env.example` to `.env`.
- Set `WEATHER_AUTH_ACCOUNTS` in `.env` to a JSON object mapping usernames to passwords.
- Adjust `WEATHER_SECRET_KEY`, `WEATHER_API_HOST`, and `WEATHER_API_PORT` as needed.
- Optional logging settings: `WEATHER_LOG_DIR`, `WEATHER_LOG_FILE`, `WEATHER_LOG_LEVEL`, `WEATHER_LOG_MAX_BYTES`, `WEATHER_LOG_BACKUP_COUNT`.
- Read-only log viewer is available at `/logs` (API: `GET /api/b2f/logs?lines=200`).

## Repo Organization:
- backend\
- devops\
- firmware\
- frontend\
- security\

