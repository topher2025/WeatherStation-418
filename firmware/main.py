from machine import Pin, I2C
import network
from time import sleep
from bme680 import BME680_I2C
import json
import socket
import ujson
import ssl


# Load json files
with open("pins.json") as f:
    pins = json.load(f)
with open("host.json") as f:
    host = ujson.load(f)

i2c = I2C(id=1, scl=Pin(pins["scl"]), sda=Pin(pins["sda"]), freq=100000)
bme = BME680_I2C(i2c=i2c)

GREEN_LED = None
LED_ON_VALUE = 1
DEBUG = False

try:
    # Use the Pico W onboard LED.
    GREEN_LED = Pin("LED", Pin.OUT)
except Exception:
    GREEN_LED = None


def _dbg(msg):
    if DEBUG:
        print("[DEBUG] {}".format(msg))


def _wrap_socket_with_ssl(sock):
    """Wrap socket with SSL/TLS, compatible with both Python 3.10+ and MicroPython"""
    try:
        # Python 3.10+ approach using SSLContext
        if hasattr(ssl, "create_default_context"):
            _dbg("Using ssl.create_default_context() TLS wrapper")
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            return context.wrap_socket(sock, server_hostname=host["ip"])
    except (AttributeError, Exception):
        _dbg("SSLContext path unavailable, falling back to ssl.wrap_socket()")

    # Fallback for MicroPython or older Python versions
    try:
        _dbg("Wrapping socket with ssl.wrap_socket(cert_reqs=CERT_NONE)")
        return ssl.wrap_socket(sock, cert_reqs=ssl.CERT_NONE)
    except TypeError:
        # Some MicroPython versions don't accept cert_reqs as keyword
        _dbg("ssl.wrap_socket does not accept cert_reqs; retrying without keyword")
        return ssl.wrap_socket(sock)



def connect_wifi():
    ssid = "Eng402"
    password = "IheartCyber"

    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if not wlan.isconnected():
        print("Connecting to WiFi...")
        _dbg("WiFi target SSID: {}".format(ssid))
        wlan.connect(ssid, password)

        timeout = 10
        while not wlan.isconnected() and timeout > 0:
            _dbg("Waiting for WiFi connection... {}s left".format(timeout))
            sleep(1)
            timeout -= 1

    if wlan.isconnected():
        print("Connected to WiFi:", wlan.ifconfig())
        _dbg("WiFi status code: {}".format(wlan.status()))
        set_green_led_connected()
    else:
        print("Failed to connect to WiFi")
        _dbg("WiFi status code on failure: {}".format(wlan.status()))


def set_green_led_connected():
    if GREEN_LED is not None:
        GREEN_LED.value(LED_ON_VALUE)


def blink_green_led_startup(times=10, on_ms=120, off_ms=120):
    if GREEN_LED is None:
        return

    off_value = 0 if LED_ON_VALUE else 1
    GREEN_LED.value(off_value)
    for _ in range(times):
        GREEN_LED.value(LED_ON_VALUE)
        sleep(on_ms / 1000)
        GREEN_LED.value(off_value)
        sleep(off_ms / 1000)


def blink_green_led_send(blink_ms=150):
    if GREEN_LED is None:
        return

    GREEN_LED.value(0 if LED_ON_VALUE else 1)
    sleep(blink_ms / 1000)
    GREEN_LED.value(LED_ON_VALUE)


def read_sensor():
    try:
        _dbg("Reading BME680 sensor data")
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

        _dbg("Sensor data: {}".format(out))

        return out
    except OSError as e:
        print("Failed to read sensor.")
        _dbg("Sensor read OSError: {}".format(e))
        return {"error": e}


def main():
    while True:
        _dbg("Starting telemetry cycle")
        data = read_sensor()
        response = send_json(data)
        if response is None:
            _dbg("Telemetry send failed after retries")
        else:
            _dbg("Telemetry send completed successfully")
        print(data)
        sleep(5)


def send_json(data, retries=3):
    payload = ujson.dumps(data)
    s = None

    _dbg("Prepared JSON payload ({} bytes)".format(len(payload)))
    _dbg("Target endpoint: https://{}:{}/api/s2b/update".format(host["ip"], host["port"]))

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
            _dbg("Send attempt {}/{}".format(i + 1, retries))
            addr = socket.getaddrinfo(host["ip"], host["port"])[0][-1]
            _dbg("Resolved address: {}".format(addr))
            s = socket.socket()
            s.settimeout(5)
            _dbg("Socket created with 5s timeout")

            # On MicroPython, connect TCP first, then wrap with TLS.
            s.connect(addr)
            _dbg("TCP connection established")

            # Wrap connected socket with SSL/TLS.
            s = _wrap_socket_with_ssl(s)
            _dbg("TLS socket ready; sending request")

            s.sendall(request.encode())
            _dbg("Request sent; awaiting response")

            response = b""
            while True:
                chunk = s.recv(1024)
                if not chunk:
                    break
                response += chunk

            status_line = response.split(b"\r\n", 1)[0]
            _dbg("Raw HTTP status line: {}".format(status_line))
            parts = status_line.split()
            if len(parts) < 2:
                raise ValueError("Malformed HTTP response")

            status_code = int(parts[1])
            _dbg("Parsed HTTP status code: {}".format(status_code))
            if 200 <= status_code < 300:
                blink_green_led_send()
                _dbg("Server accepted telemetry payload")
                return response.decode()

            raise RuntimeError("HTTP {}".format(status_code))

        except Exception as e:
            print(e)
            _dbg("Attempt {} failed with {}: {}".format(i + 1, type(e).__name__, e))

        finally:
            if s:
                s.close()
                _dbg("Socket closed")

    return None


if __name__ == "__main__":
    blink_green_led_startup()
    connect_wifi()
    main()

