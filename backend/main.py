import os
from flask import Flask, jsonify, request


app = Flask(__name__)

HOST = os.getenv("WEATHER_API_HOST", "0.0.0.0")
PORT = int(os.getenv("WEATHER_API_PORT", "443"))


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
    try:
        temperature_c = -40.0<=temperature_c<=850.0
        temperature_f = -40.0<=temperature_f<=185.0
        humidity = 0.0<=humidity<=100.0
        pressure = 300.0<=pressure<=1100.0
        gas = 0.0<=gas<=500.0
    except ValueError:
        return False
    if temperature_c and temperature_f and humidity and pressure and gas:
        return True
    else:
        return False

def log_data():
    pass


@app.post("/api/s2b/update")
def get_recent_readings():
    data = request.get_json()
    if validate_payload(data):
        log_data()



if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=False)

