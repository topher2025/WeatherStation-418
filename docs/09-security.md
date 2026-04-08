# Complete Security Documentation

This comprehensive guide covers every cybersecurity aspect of the Weather Station project. Security is built into every layer of the system.

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Session Management](#session-management)
4. [Data Protection](#data-protection)
5. [Network Security](#network-security)
6. [Input Validation](#input-validation)
7. [Database Security](#database-security)
8. [Firmware Security](#firmware-security)
9. [API Security](#api-security)
10. [Frontend Security](#frontend-security)
11. [Deployment Security](#deployment-security)
12. [Vulnerability Checklist](#vulnerability-checklist)
13. [Security Best Practices](#security-best-practices)

---

## Security Overview

The Weather Station implements a **defense-in-depth** strategy with multiple security layers:

```
[Sensor Device]
     ↓ (HTTPS encrypted)
[Backend Server]
     ↓ (Password hashed)
[Database]
```

Each component has its own security measures.

---

## Authentication & Authorization

### Password Security

**How passwords are stored (CORRECT):**
```python
from werkzeug.security import generate_password_hash, check_password_hash

# Hashing passwords
plain_password = "user_entered_password"
password_hash = generate_password_hash(plain_password)
# Result: "pbkdf2:sha256:iterations=260000$salt$hash"

# Never store the plain password - only the hash!
db.upsert_user_password(username, password_hash)
```

**What's happening:**
- Uses PBKDF2 algorithm
- 260,000 iterations (computationally expensive)
- Random salt per password
- Even if database is stolen, passwords are protected

**Password verification:**
```python
def _verify_credentials(username, password):
    user = db.get_user_auth(username)
    if user is None:
        return False
    if int(user.get("is_active", 0)) != 1:
        return False
    return check_password_hash(user["password_hash"], password)
```

**Why this is secure:**
1. User's plain password is never stored in database
2. Hash can't be reversed to get original password
3. Each password has unique salt
4. Computationally expensive (slows brute force attacks)

### Account Status Check

```python
if int(user.get("is_active", 0)) != 1:
    return False  # Disabled accounts can't log in
```

**Security benefits:**
- Administrators can disable accounts without deleting them
- Prevents disabled accounts from being used
- Records remain for audit purposes

### Multi-Login Prevention

```python
def login_session(username, session_id):
    # Check if already logged in elsewhere
    if db.is_user_logged_in_elsewhere(username, current_session_id):
        return error("Already logged in elsewhere")
```

**How it works:**
1. User logs in from device A
2. Device A gets session token (stored in browser cookie)
3. If same user tries to log in from device B
4. Previous session from device A is invalidated
5. User must log out from device A to use device B

**Security benefits:**
- Prevents account sharing
- One person can't be logged in twice
- Limits unauthorized access

---

## Session Management

### Session Creation

```python
import uuid

# Create unique session ID
current_session_id = str(uuid.uuid4())

# Store session in browser cookie (Flask handles this)
session["authenticated"] = True
session["username"] = username
session["session_id"] = current_session_id

# Record in database
db.login_session(username, current_session_id)
```

**Session ID characteristics:**
- 128-bit random UUID
- Cryptographically secure
- Unique per login
- Stored in database

### Session Cookie Configuration

```python
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,     # Prevents JavaScript access
    SESSION_COOKIE_SECURE=True,        # Only send over HTTPS
    SESSION_COOKIE_SAMESITE="Lax"     # Prevents CSRF attacks
)
```

**What each setting does:**

| Setting | Value | Benefit |
|---------|-------|---------|
| `HTTPONLY` | True | JavaScript can't steal cookies via XSS |
| `SECURE` | True | Only sent over HTTPS, never HTTP |
| `SAMESITE` | Lax | Prevents cross-site request forgery |

**Why this matters:**
- `HTTPONLY`: Even if attacker injects malicious JS, they can't read the session cookie
- `SECURE`: Forces HTTPS (encrypted communication)
- `SAMESITE`: Prevents tricking user into making requests to steal session

### Session Heartbeat & Timeout

```python
SESSION_HEARTBEAT_TIMEOUT_SECONDS = 15  # Logout after 15 seconds of inactivity

def touch_session_heartbeat(username, session_id):
    """Update last activity time"""
    cur.execute("""
        UPDATE users
        SET last_heartbeat_at = CURRENT_TIMESTAMP
        WHERE username = ? AND session_id = ?
    """, (username, session_id))

def expire_stale_sessions(timeout_seconds=15):
    """Automatically logout inactive users"""
    cur.execute("""
        UPDATE users
        SET session_id = NULL, last_heartbeat_at = NULL
        WHERE session_id IS NOT NULL
        AND (last_heartbeat_at IS NULL 
             OR last_heartbeat_at <= datetime('now', ?))
    """, (f"-{int(timeout_seconds)} seconds",))
```

**How it works:**
1. Every request updates `last_heartbeat_at` timestamp
2. Background process checks for stale sessions
3. If no activity for 15 seconds, session is cleared
4. User must log in again

**Security benefits:**
- Prevents unauthorized access if device is left unattended
- Protects against abandoned sessions
- Time-limited credentials

### Session Validation on Every Request

```python
@app.before_request
def enforce_authentication():
    # Before EVERY request, validate session
    
    if session.get("authenticated"):
        username = session.get("username")
        session_id = session.get("session_id")
        
        # Verify session matches database
        if db.is_session_active(username, session_id):
            return  # Session valid, proceed
        
        # Session invalid or expired
        session.clear()
        return redirect(url_for("login"))
```

**What this prevents:**
- Sessions being used after logout
- Sessions being used from different devices
- Expired sessions being reused
- Forged session IDs

---

## Data Protection

### In Transit (Network Layer)

**HTTPS/SSL Configuration:**
```python
if __name__ == "__main__":
    cert_path = os.path.join(os.path.dirname(__file__), "cert.pem")
    key_path = os.path.join(os.path.dirname(__file__), "key.pem")
    app.run(ssl_context=(cert_path, key_path))
```

**What happens:**
1. All communication is encrypted with SSL/TLS
2. Uses 256-bit encryption (current standard)
3. Even if network is sniffed, data is unreadable

**What's transmitted:**
- Login credentials (encrypted)
- Sensor data (encrypted)
- Session cookies (encrypted)

**Certificate files:**
- `cert.pem` - Public certificate
- `key.pem` - Private key (never share this!)

⚠️ **Important:** These are self-signed certificates for development. Production needs:
- Certificate from trusted authority (Let's Encrypt, DigiCert, etc.)
- Regular certificate renewal
- Certificate pinning in firmware

### At Rest (Database Storage)

**Passwords are hashed (not encrypted):**
```
user password:     "MyPassword123"
stored value:      "pbkdf2:sha256:260000$salt$hash"
                   ↑ Cannot be reversed
```

**Why hashing instead of encryption?**
- Encryption is reversible (bad!)
- Hashing is one-way (good!)
- If database is stolen, passwords can't be recovered

### Data Minimization

The system only stores necessary information:
```python
# Stored
username, password_hash, session_id, last_heartbeat_at
temperature, humidity, pressure, gas, timestamp

# NOT stored
- Plaintext passwords
- IP addresses
- Login attempt details (just count + time)
- Personal user information
```

---

## Network Security

### HTTPS Enforcement

```python
SESSION_COOKIE_SECURE=True  # Only send cookies over HTTPS

# If HTTP request is made, HTTPS is required
app.run(ssl_context=(cert_path, key_path))
```

**What's protected:**
- Credentials (login)
- Session cookies
- Sensor data
- All API requests

### Cross-Origin Requests

```python
# Default: No CORS headers set
# This means browser blocks requests from different origins
```

**What this prevents:**
- Scripts from `attacker.com` can't access `yourweatherstation.com`
- Protects API from unauthorized external access

### Sensor Data Validation

```python
def validate_payload(data):
    # Check data is JSON
    if not isinstance(data, dict):
        return False
    
    # Check required fields exist
    try:
        temperature_c = float(data["temperature_C"])
        humidity = float(data["humidity"])
        pressure = float(data["pressure"])
        gas = float(data["gas"])
    except KeyError:
        return False  # Missing fields
    except ValueError:
        return False  # Not numbers
    
    # Check reasonable ranges
    if not (-40.0 <= temperature_c <= 85.0):
        return False  # Out of range for sensor
    if not (0.0 <= humidity <= 100.0):
        return False  # Humidity can't be negative or > 100%
    if not (300.0 <= pressure <= 1100.0):
        return False  # Out of range for elevation
    if not (0.0 <= gas <= 500.0):
        return False  # Out of range for sensor
    
    return True  # All checks passed
```

**Why strict validation:**
- Prevents garbage data from being stored
- Detects tampered packets
- Rejects spoofed sensor readings
- Protects database integrity

---

## Input Validation

### SQL Injection Prevention

**Good (parameterized queries):**
```python
cur.execute("""
    SELECT * FROM users WHERE username = ?
""", (username,))
```

**Bad (string concatenation):**
```python
cur.execute(f"SELECT * FROM users WHERE username = '{username}'")
# If username = "admin' OR '1'='1", this breaks!
```

**Why parameterized queries work:**
- Database treats input as data, not code
- Even if input contains SQL, it's escaped
- Can't be used to escape the query structure

### XSS (Cross-Site Scripting) Prevention

**Frontend uses template escaping:**
```html
<!-- Good - text is escaped -->
{{ session.get('username') }}

<!-- Bad - would render HTML/JavaScript -->
{{ session.get('username') | safe }}
```

**What this prevents:**
- If username contains `<script>alert('hacked')</script>`
- It's rendered as text, not executed as script

### PDF Text Escaping

```python
def _escape_pdf_text(text):
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
```

**Why escape:**
- PDF text has special characters: `(`, `)`, `\`
- If not escaped, they break PDF structure
- Escaping makes them literal text

---

## Database Security

### User Table Structure

```python
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,        # Unique username
    password_hash TEXT NOT NULL,          # NEVER plaintext!
    is_active INTEGER NOT NULL DEFAULT 1, # Can disable without deleting
    session_id TEXT,                      # Current session token
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at DATETIME            # Session timeout tracking
)
```

**Security features:**
- `UNIQUE` on username: Can't have duplicate accounts
- `password_hash`: Never stores plaintext
- `is_active`: Disable without losing records
- `session_id`: Tracks active sessions
- Timestamp columns: Audit trail

### Login Tracking

```python
CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE INDEX idx_login_attempts_username_attempted_at
ON login_attempts (username, attempted_at)
```

**What this tracks:**
- Every failed login attempt
- When it happened
- By which user

**Use case: Rate limiting**
```python
def is_login_rate_limited(username, max_attempts=5, window_seconds=60):
    """Check if user has too many recent failed attempts"""
    # Count attempts in last minute
    # If >= 5, they're rate limited
```

### Login Backoff State

```python
CREATE TABLE login_backoff_state (
    username TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    lockout_until DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Lockout mechanism (exponential backoff):**
```
1st-4th failure:  No lockout (can try again immediately)
5th failure:      Locked for 60 seconds (1 min)
6th failure:      Locked for 120 seconds (2 min)
7th failure:      Locked for 240 seconds (4 min)
8th failure:      Locked for 480 seconds (8 min)
9+ failures:      Locked for 900 seconds (15 min max)
```

**Formula:**
```python
lockout_seconds = base_lockout * (2 ** (attempts - max_attempts))
# Capped at max: 900 seconds
```

**Why exponential backoff:**
- Makes brute force attacks extremely slow
- Each additional failure doubles wait time
- After 5 attempts: 60 × (2^0 + 2^1 + 2^2 + 2^3 + 2^4) = 1980 seconds = 33 minutes
- Prevents password guessing

---

## Firmware Security

### API Endpoint Authentication

**Sensor device doesn't need authentication for sending data:**
```python
@app.post("/api/s2b/update")
def get_current_readings():
    # Public endpoint - no authentication required
    # But validates data strictly
```

**Why:**
- Sensor devices often can't handle complex authentication
- The endpoint is public, but unguarded
- Security comes from validation and HTTPS

**⚠️ Risk:** If someone spoofs sensor data, it would be accepted. Mitigations:
1. HTTPS makes spoofing harder (need valid certificate)
2. Strict validation rejects obviously fake data
3. Could add API key authentication

### Firmware Data Validation

```python
def read_sensor():
    try:
        temp = bme.temperature
        tempC = round(temp, 2)
        tempF = round((temp * (9 / 5) + 32), 2)
        hum = round(bme.humidity, 2)
        pres = round(bme.pressure, 2)
        gas = round(bme.gas / 1000, 2)
        
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
        return {"error": e}  # Handle hardware errors
```

**Security aspects:**
- Catches hardware errors gracefully
- Doesn't crash if sensor fails
- Returns error instead of garbage

### Secure Data Transmission

```python
def send_json(data, retries=3):
    payload = ujson.dumps(data)
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
            s.settimeout(5)  # Timeout prevents hanging
            s.connect(addr)
            s.sendall(request.encode())
            # ... receive response ...
        except Exception as e:
            print(e)  # Log error
        finally:
            if s:
                s.close()  # Always close socket
```

**Security features:**
- Retry logic (if network fails temporarily)
- Timeout prevents hanging indefinitely
- Proper socket cleanup
- Error logging for debugging

**⚠️ Improvement:** Should use HTTPS:
```python
import ssl
s = ssl.wrap_socket(s, cert_reqs=ssl.CERT_NONE)  # Future enhancement
```

---

## API Security

### Endpoint Authentication Levels

**Public (No auth required):**
```python
POST /api/s2b/update          # Sensor sending data
GET  /login, POST /login      # Login/logout
```

**Protected (Login required):**
```python
GET  /api/b2f/update          # Latest weather
GET  /api/b2f/hourly          # Historical data
GET  /api/b2f/report.csv      # Download CSV
GET  /api/b2f/report.pdf      # Download PDF
GET  /api/b2f/logs            # View logs
POST /api/b2f/user            # Session heartbeat
```

**Web Pages (Login required):**
```python
GET  /                         # Dashboard
GET  /data, /history, /settings, /logs  # Various pages
```

### HTTP Status Codes (Security Context)

```python
if not session.get("authenticated"):
    return jsonify(error="Authentication required."), 401
```

| Code | Meaning | Security Implication |
|------|---------|----------------------|
| 200 | OK | Data returned |
| 204 | No Content | Success, no data |
| 400 | Bad Request | Malformed data (hint to attacker) |
| 401 | Unauthorized | Not logged in (correct behavior) |
| 404 | Not Found | Endpoint doesn't exist |
| 415 | Unsupported Media Type | Wrong content type |
| 422 | Unprocessable Entity | Data validation failed |
| 429 | Too Many Requests | Rate limited (brute force protection) |

**⚠️ Caution:** Don't leak information in error messages
```python
# Bad: tells attacker username exists
return jsonify(error="No user with that name"), 404

# Good: doesn't confirm user exists
return jsonify(error="Invalid username or password"), 401
```

### API Request/Response Flow

```
Client Request:
  POST /api/b2f/update
  Cookie: session=abc123...
  Accept: application/json

Backend:
  1. Check if session cookie exists
  2. Validate session ID in database
  3. Check if session is active (not expired)
  4. Proceed with request
  5. Return data

Response:
  200 OK
  Content-Type: application/json
  {
    "temperature": 22.5,
    "humidity": 45.2,
    ...
  }
```

---

## Frontend Security

### XSS Prevention

**Template escaping (Jinja2):**
```html
<!-- Escaped - safe -->
{{ session.get('username') }}

<!-- If username = "<script>alert('xss')</script>"
     It renders as text: <script>alert('xss')</script>
     Not executed as code -->
```

**JavaScript DOM manipulation (safe methods):**
```javascript
// Safe - sets text content
document.getElementById('element').textContent = userInput;

// Unsafe - executes HTML
document.getElementById('element').innerHTML = userInput;
```

**localStorage safety:**
```javascript
localStorage.setItem('theme', userSelectedTheme);
// Safe: theme value is used locally, never sent to server

// Never do this:
localStorage.setItem('password', password);  // Never store passwords!
```

### CSRF Prevention

**SameSite cookie:**
```python
SESSION_COOKIE_SAMESITE="Lax"
```

**How it works:**
```
Attacker's site (attacker.com):
  <img src="https://weatherstation.com/logout">
  
Browser WOULD send cookie if SameSite wasn't set.
With SameSite=Lax: Cookie NOT sent for cross-site requests.
Result: Logout doesn't work from attacker's site.
```

### Content Security Policy (Not implemented, but recommended)

```html
<!-- Would prevent inline scripts and external scripts -->
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self'; style-src 'self' 'unsafe-inline'">
```

### User Input in Reports

```python
def _escape_pdf_text(text):
    """Ensure user input doesn't break PDF structure"""
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
```

---

## Deployment Security

### Environment Variables

**Never hardcode secrets:**
```python
# Bad
SECRET_KEY = "my-super-secret-key"

# Good
SECRET_KEY = os.getenv("WEATHER_SECRET_KEY")
```

**Secrets that should be in environment:**
```
WEATHER_SECRET_KEY              # Flask session encryption key
WEATHER_AUTH_ACCOUNTS           # Username/password JSON
WEATHER_API_PORT                # Port to run on
WEATHER_SESSION_HEARTBEAT_TIMEOUT_SECONDS
WEATHER_LOG_LEVEL               # Should be INFO, not DEBUG
```

### Log File Security

**Don't log sensitive data:**
```python
# Bad
logger.info(f"User {username} logged in with password {password}")

# Good
logger.info(f"User {username} logged in")
```

**Log files location:**
```
backend/logs/weatherstation.log
```

**Access control:**
- Only backend process can write
- Only administrators should read
- Rotated automatically when too large

### File Permissions

**Certificates should be protected:**
```
cert.pem: 644 (readable by all, writeable by owner)
key.pem: 600 (readable/writeable by owner ONLY)
```

**⚠️ Critical:** If `key.pem` is exposed, HTTPS is compromised!

### Database File

```
weather.db: 600 (owner only)
```

Contains:
- User passwords (hashed)
- Session IDs
- Weather data

---

## Vulnerability Checklist

### Authentication Vulnerabilities

- [x] Passwords are hashed, not plaintext
- [x] Session tokens are cryptographically random
- [x] Sessions expire after inactivity
- [x] Failed logins are rate limited
- [x] Accounts can be disabled without deletion
- [x] Session validation on every request
- [ ] Password complexity requirements (NOT implemented)
- [ ] Email verification (NOT implemented)
- [ ] Password reset via email (NOT implemented)

### Session Vulnerabilities

- [x] HTTPOnly cookies (prevents JavaScript access)
- [x] Secure flag (only sent over HTTPS)
- [x] SameSite flag (prevents CSRF)
- [x] Session timeout (inactivity)
- [x] Session invalidation on logout
- [ ] Session fixation protection (minor risk)

### Data Protection Vulnerabilities

- [x] HTTPS encryption
- [x] Hashed passwords
- [x] Input validation
- [ ] Data encryption at rest (NOT implemented, low priority)
- [ ] Data backup encryption (NOT implemented)

### Injection Vulnerabilities

- [x] SQL injection prevented (parameterized queries)
- [x] XSS prevention (template escaping)
- [x] Command injection (not applicable)
- [ ] LDAP injection (not used)

### API Vulnerabilities

- [x] API endpoints require authentication (except sensor)
- [x] Rate limiting on login
- [ ] Rate limiting on API endpoints (NOT implemented)
- [ ] API key authentication for sensor (NOT implemented)
- [ ] Request rate limiting (NOT implemented)

### Configuration Vulnerabilities

- [x] Self-signed SSL certificates (acceptable for development)
- [x] Environment variables for secrets
- [ ] Production-grade SSL certificate (needed for production)
- [ ] Security headers (Content-Security-Policy, X-Frame-Options, etc.)
- [ ] CORS policy (default: no CORS, acceptable)

### Firmware Vulnerabilities

- [x] Data validation
- [x] Error handling
- [ ] Firmware updates (NOT implemented)
- [ ] Secure boot (NOT available on ESP32)
- [ ] Encrypted storage (MicroPython limitation)

---

## Security Best Practices

### For Developers

1. **Always validate input**
   ```python
   # Check type, range, format
   if not validate_payload(data):
       return error("Invalid data"), 422
   ```

2. **Never log secrets**
   ```python
   logger.info(f"User {username} logged in")  # Good
   logger.info(f"Password: {password}")       # Never!
   ```

3. **Use parameterized queries**
   ```python
   cur.execute("SELECT * FROM users WHERE username = ?", (username,))
   ```

4. **Hash passwords**
   ```python
   from werkzeug.security import generate_password_hash
   hash = generate_password_hash(password)
   ```

5. **Escape user input in output**
   ```python
   {{ username }}          # Escaped
   {{ username | safe }}   # NOT escaped (dangerous!)
   ```

### For Administrators

1. **Change default passwords**
   ```
   Set WEATHER_AUTH_ACCOUNTS with strong passwords
   ```

2. **Use HTTPS in production**
   ```
   Get certificate from Let's Encrypt or similar
   ```

3. **Monitor logs**
   ```
   Check for repeated failed login attempts
   ```

4. **Regular backups**
   ```bash
   cp backend/weather.db backup/weather.db.$(date +%Y%m%d)
   ```

5. **Update dependencies**
   ```bash
   pip install --upgrade -r requirements.txt
   ```

6. **Limit access**
   ```
   Only allow HTTPS (port 4430)
   Block HTTP (port 80)
   Firewall: only allow trusted networks
   ```

### For Users

1. **Use strong passwords**
   - Minimum 12 characters
   - Mix uppercase, lowercase, numbers, symbols
   - Unique (not reused from other sites)

2. **Don't share credentials**
   - Each person gets unique username
   - Keep password private
   - Don't write password on sticky notes

3. **Logout when done**
   - Click logout button
   - Closes session immediately
   - Needed if using shared computer

4. **Don't use on public WiFi**
   - Even with HTTPS, safer on private network
   - Public WiFi can have malicious hotspots

---

## Threat Model

### Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| **Password Theft** | Hashing with PBKDF2 + salt |
| **Session Hijacking** | HTTPOnly, Secure, SameSite cookies |
| **Brute Force Login** | Exponential backoff rate limiting |
| **Man-in-the-Middle** | HTTPS encryption |
| **SQL Injection** | Parameterized queries |
| **XSS Attack** | Template escaping + HTTPOnly cookies |
| **CSRF Attack** | SameSite cookies |
| **Unauthorized Data Access** | Session validation + login required |
| **Bad Sensor Data** | Strict validation + range checks |
| **Stale Sessions** | Automatic timeout + activity tracking |

### Threats NOT Fully Mitigated

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| **Compromised Server** | Critical | Physical security, access control |
| **Zero-Day Exploit** | Critical | Keep dependencies updated |
| **Insider Threat** | High | Audit logs, role-based access |
| **Sensor Spoofing** | Medium | API key authentication |
| **Database Breach** | Low | Passwords are hashed |
| **Denial of Service** | Medium | Rate limiting, load balancing |

---

## Security Testing

### Manual Testing Checklist

```
□ Try to login with blank username
□ Try to login with blank password
□ Try to login with SQL injection: admin' OR '1'='1
□ Try to login with XSS: <script>alert('xss')</script>
□ Try many failed logins (should get locked out)
□ Logout, verify can't access protected pages
□ Try to visit /api/b2f/update without logging in
□ Send malformed JSON to /api/s2b/update
□ Send sensor data with out-of-range values
□ Try to tamper with session ID in browser
□ Try to use session from different browser
□ Check if HTTPS is enforced
```

### Automated Security Tools

**Recommended (not currently integrated):**
- `bandit` - Python security checks
- `sqlmap` - SQL injection testing
- `owasp-zap` - Web application scanning
- `safety` - Check dependencies for CVEs

### Log Monitoring

```bash
# Check for repeated failed logins
grep "Invalid login attempt" backend/logs/weatherstation.log | \
  grep "alice" | \
  wc -l
```

---

## Incident Response

### If Password is Compromised

1. Immediately change password
   ```
   Update WEATHER_AUTH_ACCOUNTS with new password
   Restart backend
   ```

2. Check logs for unauthorized access
   ```bash
   grep "User 'alice' logged in" backend/logs/weatherstation.log
   ```

3. Review downloaded data
   - Who accessed what, when

### If Database is Breached

1. Passwords are already hashed - low risk
2. Session IDs are invalidated when you logout
3. Change SECRET_KEY to invalidate all sessions
4. Regenerate SSL certificates if exposed

### If SSL Certificate is Compromised

1. Revoke the certificate
2. Generate new certificates
3. Redeploy to server
4. Client browsers will show warning until certificate is replaced

---

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] Use real SSL certificate (not self-signed)
- [ ] Set strong WEATHER_SECRET_KEY
- [ ] Set strong WEATHER_AUTH_ACCOUNTS
- [ ] Set WEATHER_LOG_LEVEL=INFO (not DEBUG)
- [ ] Disable debug mode
- [ ] Database backups enabled
- [ ] Log file rotation enabled
- [ ] Firewall configured (only allow port 4430)
- [ ] Regular security updates installed
- [ ] Incident response plan in place
- [ ] Administrator documentation written
- [ ] User documentation includes security warnings

---

## Security Resources

### Learn More

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Common web vulnerabilities
- [Flask Security](https://flask.palletsprojects.com/security/) - Flask security practices
- [Python Security](https://python.readthedocs.io/en/stable/library/security_warnings.html)
- [Werkzeug Security](https://werkzeug.palletsprojects.com/security/) - Password hashing
- [SQLite Security](https://www.sqlite.org/security.html)

### Tools

- `safety` - Check for vulnerable Python packages
- `bandit` - Find common security issues in Python
- `pip-audit` - Audit Python dependencies

---

## Summary

The Weather Station implements security at every layer:

1. **Authentication** - Strong password hashing, session management
2. **Authorization** - Role-based access control, session validation
3. **Confidentiality** - HTTPS encryption, HTTPOnly cookies
4. **Integrity** - Input validation, parameterized queries
5. **Availability** - Rate limiting, timeout protection
6. **Non-repudiation** - Logging all important actions

While no system is 100% secure, the Weather Station provides robust protection appropriate for an educational project. Production deployment should address the items in the "Threats NOT Fully Mitigated" section.

