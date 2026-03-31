# HTTPS Setup Guide

## Overview
Both the backend Flask API and the firmware now use HTTPS/TLS for secure communication.

## Backend Configuration

### SSL Certificates
The backend uses self-signed SSL certificates for HTTPS:
- **cert.pem** - SSL certificate (public key)
- **key.pem** - SSL private key

These were generated using the `generate_certs.py` script and are valid for 365 days.

### Running the Backend
The Flask app now automatically starts with HTTPS enabled:

```bash
cd backend
python main.py
```

The server will run on `https://0.0.0.0:4430` (or whatever port is configured in `WEATHER_API_PORT`).

### Updating Certificates
When the certificates expire, regenerate them (from the root project directory):

```bash
python generate_certs.py
```

## Firmware Configuration

### HTTPS Support
The MicroPython firmware now supports HTTPS connections to the backend:

- Uses `ssl.wrap_socket()` with `cert_reqs=ssl.CERT_NONE` to accept self-signed certificates
- Automatically wraps the socket before connecting
- Maintains retry logic for failed connections

### Configuration Required
Update your `host.json` on the Pi Pico with the correct backend server:

```json
{
  "ip": "your-server-ip-or-hostname",
  "port": 4430
}
```

## Testing HTTPS Connection

### From Command Line
```bash
curl -k https://localhost:4430/api/b2f/system-info
```
(Note: `-k` flag ignores self-signed certificate warnings)

### From Python
```python
import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning

# Suppress SSL warnings for self-signed cert
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

response = requests.get('https://localhost:4430/api/b2f/system-info', verify=False)
print(response.json())
```

## Ports
- **Backend HTTPS**: Port 4430 (configurable via `WEATHER_API_PORT` env var)
- **Frontend**: Will connect via HTTPS to `https://0.0.0.0:4430`

## Security Notes

### Self-Signed Certificates
- Good for development and internal networks
- Browsers/clients will show certificate warnings
- Use `-k` flag with curl or `verify=False` with requests to bypass validation

### Production Considerations
For production, replace with:
1. **Let's Encrypt certificates** - Free, automated, trusted by browsers
2. **Commercial SSL certificates** - From trusted CAs
3. **Update `ssl_context` in Flask** - Change from `("cert.pem", "key.pem")` to proper cert paths

## Troubleshooting

### Certificate Errors
If you get certificate verification errors:
- Ensure `cert.pem` and `key.pem` exist in the backend directory
- Regenerate with `python generate_certs.py` if expired
- For client connections, use `verify=False` or `-k` flag for self-signed certs

### Firmware Connection Issues
- Verify `host.json` has correct IP/port
- Check backend is running with HTTPS enabled
- Monitor serial console for SSL/TLS errors

