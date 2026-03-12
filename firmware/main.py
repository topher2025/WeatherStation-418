import socket
import ujson


with open("host.json") as f:
    host = ujson.load(f)


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
            addr = (socket.getaddrinfo(host["ip"], host["port"])[0][-1])
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

