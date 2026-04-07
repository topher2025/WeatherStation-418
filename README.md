# WeatherStation-418

## Local setup
- Copy `.env.example` to `.env`.
- Set `WEATHER_AUTH_ACCOUNTS` in `.env` to a JSON object mapping usernames to passwords.
- Adjust `WEATHER_SECRET_KEY`, `WEATHER_API_HOST`, and `WEATHER_API_PORT` as needed.
- `WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS` defaults to `15` seconds for the backend heartbeat session check.
- The frontend idle logout in `frontend/static/logout.js` is set to `15` minutes of inactivity.
- Optional logging settings: `WEATHER_LOG_DIR`, `WEATHER_LOG_FILE`, `WEATHER_LOG_LEVEL`, `WEATHER_LOG_MAX_BYTES`, `WEATHER_LOG_BACKUP_COUNT`.
- Logs are persisted in a server-side `.log` file at `WEATHER_LOG_DIR/WEATHER_LOG_FILE` (default: `backend/logs/weatherstation.log`).
- Read-only log viewer is available at `/logs` (API: `GET /api/b2f/logs?lines=200`) and supports download via `GET /api/b2f/logs/download`.

## Repo Organization:
- backend\
- devops\
- firmware\
- frontend\
- security\

