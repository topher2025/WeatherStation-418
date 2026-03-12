from machine import Pin, I2C
from time import sleep
from bme680 import BME680_I2C
import json
import socket
import ujson

# Load json files
with open("pins.json") as f:
    pins = json.load(f)
with open("host.json") as f:
    host = ujson.load(f)

i2c = I2C(id=1, scl=Pin(pins["scl"]), sda=Pin(pins["sda"]), freq=100000)
bme = BME680_I2C(i2c=i2c)


def read_sensor():
    try:
        temp = bme.temperature
        tempC = round(temp, 2)  # Celsius
        tempF = round((temp * (9 / 5) + 32), 2)  # Fahrenheit
        hum = round(bme.humidity, 2)  # Percent
        pres = round(bme.pressure, 2)  # hPa
        gas = round(bme.gas / 1000, 2)  # kOhms

        out = {
            "temperature_C": tempC,
            "temperature_F": tempF,
            "humidity": hum,
            "pressure": pres,
            "gas": gas,
        }

        return out
    except OSError as e:
        print("Failed to read sensor.")
        return {"error": e}


def main():
    while True:
        data = read_sensor()
        print(data)
        sleep(1)


def send_json(data, retries=3):
    payload = ujson.dumps(data)
    s = None

    request = (
        "POST {} HTTP/1.1\r\n"
        "Host: {}\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: {}\r\n"
        "Connection: close\r\n"
        "\r\n"
        "{}"
    ).format("/api/s2b/update", host["ip"], len(payload), payload)

    for i in range(retries):
        try:
            addr = socket.getaddrinfo(host["ip"], host["port"])[0][-1]
            s = socket.socket()
            s.settimeout(5)
            s.connect(addr)
            s.sendall(request.encode())

            response = b""
            while True:
                chunk = s.recv(1024)
                if not chunk:
                    break
                response += chunk

            status_line = response.split(b"\r\n", 1)[0]
            parts = status_line.split()
            if len(parts) < 2:
                raise ValueError("Malformed HTTP response")

            status_code = int(parts[1])
            if 200 <= status_code < 300:
                return response.decode()

            raise RuntimeError("HTTP {}".format(status_code))

        except Exception as e:
            print(e)

        finally:
            if s:
                s.close()

    return None


main()
