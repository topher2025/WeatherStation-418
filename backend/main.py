import os
import uuid
from flask import Flask, jsonify, request, render_template, redirect, session, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import database as db

app = Flask(__name__, template_folder="../frontend", static_folder="../frontend/static", static_url_path="/static")

app.config["SECRET_KEY"] = os.getenv("WEATHER_SECRET_KEY", "weather-station-dev-secret-change-me")

HOST = os.getenv("WEATHER_API_HOST", "0.0.0.0")
PORT = int(os.getenv("WEATHER_API_PORT", "4430"))

# Five hardcoded users (passwords must be changed in database only)
HARDCODED_ACCOUNTS = {
    "ops1": "RainOps!418",
    "ops2": "SkyWatch!729",
    "ops3": "Barometer#552",
    "ops4": "Nimbus$840",
    "ops5": "TempFlux%991",
}

_AUTH_BOOTSTRAPPED = False


def _is_safe_next(target: str | None) -> bool:
    return bool(target) and target.startswith("/") and not target.startswith("//")


def _verify_credentials(username: str, password: str) -> bool:
    _bootstrap_auth_accounts()
    user = db.get_user_auth(username)
    if user is None:
        return False
    if int(user.get("is_active", 0)) != 1:
        return False
    return check_password_hash(user["password_hash"], password)


def _bootstrap_auth_accounts(force_update=False):
    global _AUTH_BOOTSTRAPPED
    if _AUTH_BOOTSTRAPPED and not force_update:
        return

    db.init_db()

    for username, plain_password in HARDCODED_ACCOUNTS.items():
        password_hash = generate_password_hash(plain_password)
        db.upsert_user_password(username, password_hash, is_active=1)

    _AUTH_BOOTSTRAPPED = True


@app.before_request
def enforce_authentication():
    public_endpoints = {"login_page", "logout"}
    unprotected_api_prefixes = ("/api/s2b/", "/api/b2f/")

    if request.endpoint == "static" or request.path.startswith("/static/"):
        return

    if request.endpoint in public_endpoints:
        return

    if request.path.startswith(unprotected_api_prefixes):
        return

    if session.get("authenticated"):
        return

    if request.path.startswith("/api/"):
        return jsonify(error="Authentication required."), 401

    next_target = request.full_path if request.query_string else request.path
    return redirect(url_for("login_page", next=next_target))


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

    temperature_c_b = -40.0<=temperature_c<=85.0
    temperature_f_b = -40.0<=temperature_f<=185.0
    humidity_b = 0.0<=humidity<=100.0
    pressure_b = 300.0<=pressure<=1100.0
    gas_b = 0.0<=gas<=500.0

    return temperature_c_b and temperature_f_b and humidity_b and pressure_b and gas_b


def log_data(data: dict):
    db.insert_weather(data["temperature_C"], data["humidity"], data["pressure"], data["gas"])


@app.get("/")
def index():
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login_page():
    if request.method == "GET":
        if session.get("authenticated"):
            return redirect(url_for("index"))
        next_target = request.args.get("next", "/")
        if not _is_safe_next(next_target):
            next_target = "/"
        return render_template("login.html", error=None, next_target=next_target)

    username = request.form.get("username", "")
    password = request.form.get("password", "")
    next_target = request.form.get("next", "/")

    if _verify_credentials(username, password):
        # Check if user is already logged in elsewhere
        current_session_id = str(uuid.uuid4())
        if db.is_user_logged_in_elsewhere(username, current_session_id):
            return render_template(
                "login.html",
                error="This account is already logged in on another device. Please log out from the other session first.",
                next_target=next_target
            ), 409

        # Log in user on this device/session
        db.login_session(username, current_session_id)
        session["authenticated"] = True
        session["username"] = username
        session["session_id"] = current_session_id
        if _is_safe_next(next_target):
            return redirect(next_target)
        return redirect(url_for("index"))

    if not _is_safe_next(next_target):
        next_target = "/"
    return render_template("login.html", error="Invalid username or password.", next_target=next_target), 401


@app.route("/logout", methods=["GET", "POST"])
def logout():
    print("\n=== LOGOUT ROUTE CALLED ===")
    print(f"Request method: {request.method}")
    print(f"Request path: {request.path}")
    
    username = session.get("username")
    session_id = session.get("session_id")
    print(f"Current session username: {username}")
    print(f"Current session_id: {session_id}")
    
    if username:
        print(f"Clearing session for user: {username}")
        try:
            db.logout_session(username)
            print(f"✓ Database logout_session() completed for {username}")
        except Exception as e:
            print(f"✗ Error calling logout_session: {e}")
    else:
        print("No username in session - user may not be logged in")
    
    session.clear()
    print("✓ Flask session cleared")
    
    # If this is a sendBeacon request (from beforeunload), return 200 OK
    # Otherwise redirect to login page
    is_beacon = request.method == "POST" and not request.form and not request.is_json
    print(f"Is beacon request: {is_beacon}")
    
    if is_beacon:
        print("Returning 200 OK for beacon request")
        return "", 200
    
    print("Redirecting to login page")
    return redirect(url_for("login_page"))

@app.get("/history")
def history_page():
    return render_template("history.html")

@app.get("/settings")
def settings_page():
    return render_template("settings.html") 



@app.post("/api/s2b/update")
def get_current_readings():

    if not request.is_json:
        return jsonify(error="Request body must be JSON."), 415

    data = request.get_json(silent=True)
    print("data:  " + str(data))
    if data is None:
        return jsonify(error="Request body must contain valid JSON."), 400

    if not validate_payload(data):
        return jsonify(error="Payload failed validation."), 422

    log_data(data)
    return "", 204

@app.get("/api/b2f/update")
def get_latest_readings():
    latest = db.get_latest_weather()
    if latest is None:
        return jsonify(error="No weather data available."), 404
    return jsonify(latest)

@app.get("/api/b2f/hourly")
def get_hourly_readings():
    hours = request.args.get('hours', default=12, type=int)
    hourly_data = db.get_hourly_weather(hours)
    if not hourly_data:
        return jsonify(error="No historical data available."), 404
    return jsonify(hourly_data)

@app.get("/api/b2f/system-info")
def get_system_info():
    """Get system information about the weather station"""
    latest = db.get_latest_weather()
    if latest is None:
        return jsonify(error="No data available."), 404
    
    return jsonify({
        "firmware_version": "1.0.0",
        "last_connection": latest.get("timestamp", "Unknown"),
        "uptime": "Running",
        "data_points": db.get_data_point_count()
    })

if __name__ == "__main__":
    _bootstrap_auth_accounts()
    app.run(host=HOST, port=PORT, debug=False)
