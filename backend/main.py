import os
from flask import Flask, jsonify, request


app = Flask(__name__)

HOST = os.getenv("WEATHER_API_HOST", "0.0.0.0")
PORT = int(os.getenv("WEATHER_API_PORT", "4430"))


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
    pass


@app.post("/api/s2b/update")
def get_current_readings():
    if not request.is_json:
        return jsonify(error="Request body must be JSON."), 415

    data = request.get_json(silent=True)
    if data is None:
        return jsonify(error="Request body must contain valid JSON."), 400

    if not validate_payload(data):
        return jsonify(error="Payload failed validation."), 422

    log_data(data)
    return "", 204



if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=False)

