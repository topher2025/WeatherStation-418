from time import sleep
import json
import socket
import os

from random import randint

# Load json files

with open("host.json") as f:
    host = json.load(f)

host["ip"] = os.getenv("WEATHER_API_HOST", host.get("ip", "backend"))
host["port"] = int(os.getenv("WEATHER_API_PORT", str(host.get("port", 4430))))


def read_sensor():
    try:
        tempC = randint(20, 70)  # Celsius
        tempF = round((tempC * (9 / 5) + 32), 2)  # Fahrenheit
        hum = randint(0, 100)  # Percent
        pres = randint(300, 1100)  # hPa
        gas = randint(0, 500)  # kOhms

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
        send_json(data)
        print(data)
        sleep(5)


def send_json(data, retries=3):
    payload = json.dumps(data)
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


if __name__ == "__main__":
    main()
