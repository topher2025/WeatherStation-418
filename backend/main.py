import csv
import json
import logging
import os
import uuid
from logging.handlers import RotatingFileHandler
from io import BytesIO, StringIO
from pathlib import Path
from flask import Flask, jsonify, request, render_template, redirect, send_file, session, url_for
from flask.sessions import SecureCookieSessionInterface
from werkzeug.security import generate_password_hash, check_password_hash
import database as db
from utils.report_pdf import build_weather_pdf

try:
    from dotenv import load_dotenv as _load_dotenv
except ImportError:

    def _load_dotenv() -> None:
        return None


app = Flask(
    __name__,
    template_folder="../frontend",
    static_folder="../frontend/static",
    static_url_path="/static",
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=False,  # overridden per request by RequestAwareSessionInterface
    SESSION_COOKIE_SAMESITE="Lax"
)


class RequestAwareSessionInterface(SecureCookieSessionInterface):
    def get_cookie_secure(self, app):
        return request.is_secure


app.session_interface = RequestAwareSessionInterface()


def _load_local_env() -> None:
    _load_dotenv()

    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("export "):
            stripped = stripped[len("export ") :].lstrip()
        if "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if len(value) >= 2 and (
            (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'"))
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


_load_local_env()

app.config["SECRET_KEY"] = os.getenv("WEATHER_SECRET_KEY", "weather-station-dev-secret-change-me")

HOST = os.getenv("WEATHER_API_HOST", "0.0.0.0")
PORT = int(os.getenv("WEATHER_API_PORT", "4430"))
SESSION_HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS", "15"))
LOGIN_ATTEMPT_MAX_ATTEMPTS = int(os.getenv("WEATHER_LOGIN_ATTEMPT_MAX_ATTEMPTS", "5"))
LOGIN_ATTEMPT_BASE_LOCKOUT_SECONDS = int(os.getenv("WEATHER_LOGIN_ATTEMPT_BASE_LOCKOUT_SECONDS", "60"))
LOGIN_ATTEMPT_MAX_LOCKOUT_SECONDS = int(os.getenv("WEATHER_LOGIN_ATTEMPT_MAX_LOCKOUT_SECONDS", "900"))

AUTH_ACCOUNTS_ENV_VAR = "WEATHER_AUTH_ACCOUNTS"
MAX_REPORT_HOURS = 168

DEFAULT_LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR = Path(os.getenv("WEATHER_LOG_DIR", str(DEFAULT_LOG_DIR))).resolve()
LOG_FILE_NAME = Path(os.getenv("WEATHER_LOG_FILE", "weatherstation.log")).name
LOG_FILE_PATH = LOG_DIR / LOG_FILE_NAME
LOG_LEVEL = os.getenv("WEATHER_LOG_LEVEL", "INFO").upper()
LOG_MAX_BYTES = int(os.getenv("WEATHER_LOG_MAX_BYTES", str(2 * 1024 * 1024)))
LOG_BACKUP_COUNT = int(os.getenv("WEATHER_LOG_BACKUP_COUNT", "5"))
LOG_VIEW_DEFAULT_LINES = int(os.getenv("WEATHER_LOG_VIEW_DEFAULT_LINES", "200"))
LOG_VIEW_MAX_LINES = int(os.getenv("WEATHER_LOG_VIEW_MAX_LINES", "1000"))


def _configure_logging() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("weatherstation")
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    logger.handlers.clear()

    formatter = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")

    file_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=max(1, LOG_MAX_BYTES),
        backupCount=max(1, LOG_BACKUP_COUNT),
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    logger.propagate = False
    return logger


logger = _configure_logging()

_AUTH_BOOTSTRAPPED = False


def _is_safe_next(target: str | None) -> bool:
    return bool(target) and target.startswith("/") and not target.startswith("//")


def _format_wait_min_sec(total_seconds: int) -> str:
    seconds = max(0, int(total_seconds))
    minutes, remaining_seconds = divmod(seconds, 60)
    return f"{minutes}:{remaining_seconds:02d}"


def _verify_credentials(username: str, password: str) -> bool:
    _bootstrap_auth_accounts()
    user = db.get_user_auth(username)
    if user is None:
        return False
    if int(user.get("is_active", 0)) != 1:
        return False
    return check_password_hash(user["password_hash"], password)


def _load_auth_accounts() -> dict[str, str]:
    raw_accounts = os.getenv(AUTH_ACCOUNTS_ENV_VAR)
    if not raw_accounts:
        raise RuntimeError(
            f"{AUTH_ACCOUNTS_ENV_VAR} must be set as an environment variable containing a JSON object mapping"
            f" usernames to passwords (for local development, you can set this in a .env file)."
        )

    try:
        accounts = json.loads(raw_accounts)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{AUTH_ACCOUNTS_ENV_VAR} must contain valid JSON.") from exc

    if not isinstance(accounts, dict):
        raise RuntimeError(f"{AUTH_ACCOUNTS_ENV_VAR} must be a JSON object mapping usernames to passwords.")

    normalized_accounts: dict[str, str] = {}
    for username, password in accounts.items():
        if not isinstance(username, str) or not username.strip():
            raise RuntimeError(f"{AUTH_ACCOUNTS_ENV_VAR} contains an invalid username.")
        if not isinstance(password, str) or not password:
            raise RuntimeError(f"{AUTH_ACCOUNTS_ENV_VAR} contains an invalid password for '{username}'.")
        normalized_accounts[username.strip()] = password

    if not normalized_accounts:
        raise RuntimeError(f"{AUTH_ACCOUNTS_ENV_VAR} must define at least one account.")

    return normalized_accounts


def _bootstrap_auth_accounts(force_update=False):
    global _AUTH_BOOTSTRAPPED
    if _AUTH_BOOTSTRAPPED and not force_update:
        return

    db.init_db()

    for username, plain_password in _load_auth_accounts().items():
        password_hash = generate_password_hash(plain_password)
        db.upsert_user_password(username, password_hash, is_active=1)

    _AUTH_BOOTSTRAPPED = True
    logger.info("Authentication accounts bootstrapped")


def _tail_log_lines(line_count: int, newest_first: bool = False) -> list[str]:
    if line_count <= 0:
        return []
    if not LOG_FILE_PATH.exists():
        return []

    with LOG_FILE_PATH.open("r", encoding="utf-8", errors="replace") as log_file:
        lines = log_file.read().splitlines()
    tail = lines[-line_count:]
    if newest_first:
        return list(reversed(tail))
    return tail


def _expire_stale_user_sessions():
    db.expire_stale_sessions(SESSION_HEARTBEAT_TIMEOUT_SECONDS)


def _sanitize_report_hours(value, default=24):
    try:
        hours = abs(int(value))
    except (TypeError, ValueError):
        hours = default

    return max(1, min(hours, MAX_REPORT_HOURS))


def _parse_report_range(raw_value, default_hours=24):
    token = str(raw_value or default_hours).strip().lower()
    if token in {"all", "all-time", "all_time"}:
        return "all", None
    return "hours", _sanitize_report_hours(token, default_hours)


def _report_range_label(range_kind, hours):
    if range_kind == "all":
        return "All time"
    return f"Last {hours} hours"


def _get_report_rows(range_kind, hours):
    if range_kind == "all":
        return db.get_all_weather()
    return db.get_hourly_weather(hours)


def _get_report_rows_for_pdf(range_kind, hours):
    """Get hourly-averaged data for PDF reports (keeps website data unchanged)"""
    if range_kind == "all":
        return db.get_all_hourly_average_weather()
    return db.get_hourly_average_weather(hours)


def _format_report_rows(rows):
    formatted_rows = []
    for row in rows:
        local_timestamp = db.utc_to_local(row["timestamp"])
        formatted_rows.append(
            {
                "timestamp_utc": row["timestamp"],
                "timestamp_local": local_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "temperature": float(row["temperature"]),
                "humidity": float(row["humidity"]),
                "pressure": float(row["pressure"]),
                "gas_resistance": float(row["gas_resistance"]),
            }
        )
    return formatted_rows


def _build_report_filename(range_kind, hours, extension):
    from datetime import datetime as _datetime

    generated_at = _datetime.now().strftime("%Y%m%d-%H%M%S")
    if range_kind == "all":
        return f"weather-report-all-time-{generated_at}.{extension}"
    return f"weather-report-{_sanitize_report_hours(hours)}h-{generated_at}.{extension}"


def _build_weather_csv(rows):
    formatted_rows = _format_report_rows(rows)
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "timestamp_local",
            "timestamp_utc",
            "temperature",
            "humidity",
            "pressure",
            "gas_resistance",
        ],
    )
    writer.writeheader()
    writer.writerows(formatted_rows)
    output.seek(0)
    return output.getvalue().encode("utf-8")



@app.before_request
def enforce_authentication():
    public_endpoints = {"login", "logout"}
    unprotected_api_prefixes = ("/api/s2b/",)

    if request.endpoint == "static" or request.path.startswith("/static/"):
        return

    _expire_stale_user_sessions()

    if request.endpoint in public_endpoints:
        return

    if request.path.startswith(unprotected_api_prefixes):
        return

    if session.get("authenticated"):
        username = session.get("username")
        session_id = session.get("session_id")
        if db.is_session_active(username, session_id):
            return

        # Session is stale or replaced by another login; force re-authentication.
        logger.info("Session expired for user '%s'", username)
        session.clear()

    if request.path.startswith("/api/"):
        logger.warning("Unauthorized API request to '%s'", request.path)
        return jsonify(error="Authentication required."), 401

    next_target = request.full_path if request.query_string else request.path
    return redirect(url_for("login", next=next_target))


def validate_payload(payload: dict):
    try:
        temperature_c = payload["temperature_C"]
        temperature_f = payload["temperature_F"]
        humidity = payload["humidity"]
        pressure = payload["pressure"]
        gas = payload["gas"]
    except KeyError:
        return False
    try:
        temperature_c = float(temperature_c)
        temperature_f = float(temperature_f)
        humidity = float(humidity)
        pressure = float(pressure)
        gas = float(gas)
    except ValueError:
        return False

    temperature_c_b = -40.0 <= temperature_c <= 85.0
    temperature_f_b = -40.0 <= temperature_f <= 185.0
    humidity_b = 0.0 <= humidity <= 100.0
    pressure_b = 300.0 <= pressure <= 1100.0
    gas_b = 0.0 <= gas <= 500.0

    return temperature_c_b and temperature_f_b and humidity_b and pressure_b and gas_b


def log_data(data: dict):
    db.insert_weather(data["temperature_C"], data["humidity"], data["pressure"], data["gas"])


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/data")
def data_page():
    range_kind, hours = _parse_report_range(request.args.get("hours", "24"), default_hours=24)
    default_range = "all" if range_kind == "all" else str(hours)
    return render_template("data.html", default_range=default_range)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if session.get("authenticated"):
            return redirect(url_for("index"))
        next_target = request.args.get("next", "/")
        if not _is_safe_next(next_target):
            next_target = "/"
        return render_template("login.html", error=None, next_target=next_target)

    _bootstrap_auth_accounts()

    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    next_target = request.form.get("next", "/")
    if not _is_safe_next(next_target):
        next_target = "/"

    lockout_seconds = db.get_login_lockout_seconds_remaining(username)
    if lockout_seconds > 0:
        logger.warning("Login blocked by lockout for user '%s'", username)
        wait_display = _format_wait_min_sec(lockout_seconds)
        return (
            render_template(
                "login.html",
                error=f"Too many login attempts. Please wait {wait_display} and try again.",
                next_target=next_target,
            ),
            429,
            {"Retry-After": str(lockout_seconds)},
        )

    if _verify_credentials(username, password):
        db.clear_failed_login_attempts(username)

        # Check if user is already logged in elsewhere
        current_session_id = str(uuid.uuid4())
        if db.is_user_logged_in_elsewhere(username, current_session_id):
            logger.warning("Login blocked for user '%s' due to active session elsewhere", username)
            return (
                render_template(
                    "login.html",
                    error="This account is already logged in on another device."
                    " Please log out from the other session first.",
                    next_target=next_target,
                ),
                409,
            )

        # Log in user on this device/session
        db.login_session(username, current_session_id)
        session["authenticated"] = True
        session["username"] = username
        session["session_id"] = current_session_id
        logger.info("User '%s' logged in", username)
        if _is_safe_next(next_target):
            return redirect(next_target)
        return redirect(url_for("index"))

    lockout_seconds = db.record_failed_login_attempt(
        username,
        max_attempts=LOGIN_ATTEMPT_MAX_ATTEMPTS,
        base_lockout_seconds=LOGIN_ATTEMPT_BASE_LOCKOUT_SECONDS,
        max_lockout_seconds=LOGIN_ATTEMPT_MAX_LOCKOUT_SECONDS,
    )

    if lockout_seconds > 0:
        logger.warning("User '%s' reached login lockout", username)
        wait_display = _format_wait_min_sec(lockout_seconds)
        return (
            render_template(
                "login.html",
                error=f"Too many login attempts. Please wait {wait_display} and try again.",
                next_target=next_target,
            ),
            429,
            {"Retry-After": str(lockout_seconds)},
        )

    logger.warning("Invalid login attempt for user '%s'", username)
    return (
        render_template("login.html", error="Invalid username or password.", next_target=next_target),
        401,
    )


@app.route("/logout", methods=["GET", "POST"])
def logout():
    username = session.get("username")
    logger.info("Logout requested via %s for user '%s'", request.method, username)

    if username:
        try:
            db.logout_session(username)
        except Exception:
            logger.exception("Failed to clear DB-backed session for user '%s'", username)

    session.clear()
    if request.method == "POST":
        return "", 200
    return redirect(url_for("login"))


@app.get("/history")
def history_page():
    return render_template("history.html")


@app.get("/settings")
def settings_page():
    return render_template("settings.html")


@app.get("/logs")
def logs_page():
    return render_template("logs.html")


@app.get("/api/b2f/report.csv")
def download_weather_report_csv():
    range_kind, hours = _parse_report_range(request.args.get("hours", "24"), default_hours=24)
    rows = _get_report_rows(range_kind, hours)
    if not rows:
        return jsonify(error="No historical data available."), 404

    csv_buffer = BytesIO(_build_weather_csv(rows))
    return send_file(
        csv_buffer,
        mimetype="text/csv",
        as_attachment=True,
        download_name=_build_report_filename(range_kind, hours, "csv"),
    )


@app.get("/api/b2f/report.pdf")
def download_weather_report_pdf():
    range_kind, hours = _parse_report_range(request.args.get("hours", "24"), default_hours=24)
    rows = _get_report_rows_for_pdf(range_kind, hours)
    if not rows:
        return jsonify(error="No historical data available."), 404

    formatted_rows = _format_report_rows(rows)
    pdf_buffer = build_weather_pdf(formatted_rows, _report_range_label(range_kind, hours))
    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=_build_report_filename(range_kind, hours, "pdf"),
    )


@app.post("/api/s2b/update")
def get_current_readings():

    if not request.is_json:
        logger.warning("Sensor update rejected: non-JSON content")
        return jsonify(error="Request body must be JSON."), 415

    data = request.get_json(silent=True)
    if data is None:
        logger.warning("Sensor update rejected: malformed JSON")
        return jsonify(error="Request body must contain valid JSON."), 400

    if not validate_payload(data):
        logger.warning("Sensor update rejected: payload validation failed")
        return jsonify(error="Payload failed validation."), 422

    log_data(data)
    logger.info("Sensor update accepted")
    return "", 204


@app.get("/api/b2f/logs")
def get_logs():
    requested_lines = request.args.get("lines", default=LOG_VIEW_DEFAULT_LINES, type=int)
    if requested_lines is None:
        requested_lines = LOG_VIEW_DEFAULT_LINES
    requested_lines = max(1, min(requested_lines, LOG_VIEW_MAX_LINES))

    requested_order = str(request.args.get("order", "desc")).strip().lower()
    newest_first = requested_order != "asc"

    lines = _tail_log_lines(requested_lines, newest_first=newest_first)
    log_exists = LOG_FILE_PATH.exists()
    log_size_bytes = LOG_FILE_PATH.stat().st_size if log_exists else 0
    return jsonify(
        {
            "log_file": LOG_FILE_NAME,
            "log_dir": str(LOG_DIR),
            "exists": log_exists,
            "size_bytes": log_size_bytes,
            "line_count": len(lines),
            "max_lines": LOG_VIEW_MAX_LINES,
            "order": "desc" if newest_first else "asc",
            "lines": lines,
        }
    )


@app.get("/api/b2f/logs/download")
def download_logs():
    if not LOG_FILE_PATH.exists():
        return jsonify(error="Log file does not exist yet."), 404

    requested_order = str(request.args.get("order", "desc")).strip().lower()
    newest_first = requested_order != "asc"

    logger.info("Log download requested by user '%s'", session.get("username"))

    if newest_first:
        with LOG_FILE_PATH.open("r", encoding="utf-8", errors="replace") as log_file:
            lines = log_file.read().splitlines()
        reversed_content = "\n".join(reversed(lines)).encode("utf-8")
        return send_file(
            BytesIO(reversed_content),
            mimetype="text/plain",
            as_attachment=True,
            download_name=LOG_FILE_NAME,
        )

    return send_file(
        LOG_FILE_PATH,
        mimetype="text/plain",
        as_attachment=True,
        download_name=LOG_FILE_NAME,
        conditional=True,
    )


@app.get("/api/b2f/update")
def get_latest_readings():
    latest = db.get_latest_weather()
    if latest is None:
        return jsonify(error="No weather data available."), 404
    return jsonify(latest)


@app.get("/api/b2f/hourly")
def get_hourly_readings():
    range_kind, hours = _parse_report_range(request.args.get("hours", "12"), default_hours=12)
    hourly_data = _get_report_rows(range_kind, hours)
    if not hourly_data:
        return jsonify(error="No historical data available."), 404
    return jsonify(hourly_data)


@app.get("/api/b2f/system-info")
def get_system_info():
    """Get system information about the weather station"""
    latest = db.get_latest_weather()
    if latest is None:
        return jsonify(error="No data available."), 404

    return jsonify(
        {
            "firmware_version": "1.0.0",
            "last_connection": latest.get("timestamp", "Unknown"),
            "uptime": "Running",
            "data_points": db.get_data_point_count(),
        }
    )


@app.post("/api/b2f/user")
def user():
    _expire_stale_user_sessions()

    if not session.get("authenticated"):
        return jsonify(error="Authentication required."), 401

    username = session.get("username")
    session_id = session.get("session_id")
    if not db.is_session_active(username, session_id):
        session.clear()
        return jsonify(error="Session expired."), 401

    if not db.touch_session_heartbeat(username, session_id):
        session.clear()
        return jsonify(error="Session expired."), 401

    return "", 204


if __name__ == "__main__":
    _bootstrap_auth_accounts()
    cert_path = os.path.join(os.path.dirname(__file__), "cert.pem")
    key_path = os.path.join(os.path.dirname(__file__), "key.pem")
    logger.info("Starting WeatherStation backend on %s:%s", HOST, PORT)
    app.run(host=HOST, port=PORT, ssl_context=(cert_path, key_path), threaded=True)
