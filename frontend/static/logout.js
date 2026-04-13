// Only explicit clicks on /logout should end a session.
document.querySelectorAll('a[href="/logout"]').forEach(function (link) {
    link.addEventListener('click', function () {
        link.classList.add('disabled');
        link.setAttribute('aria-disabled', 'true');
    });
});

var IDLE_TIMEOUT_SEC = 15 * 60;
var IDLE_TIMEOUT_MS = 1000 * IDLE_TIMEOUT_SEC;
var MOUSEMOVE_THROTTLE_MS = 500;
var HEARTBEAT_INTERVAL_MS = 5000;
var IDLE_STORAGE_KEY = 'weatherstation:last-activity-at';
var idleTimeoutObj = null;
var heartbeatIntervalObj = null;
var lastMouseReset = 0;
var lastActivityAt = 0;

function shouldTrackIdle() {
    return window.location.pathname !== '/login';
}

function readLastActivityAt() {
    var rawValue = localStorage.getItem(IDLE_STORAGE_KEY);
    var parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return Date.now();
    }
    if (Date.now() - parsedValue >= IDLE_TIMEOUT_MS) {
        return Date.now();
    }
    return parsedValue;
}

function persistLastActivityAt(value) {
    localStorage.setItem(IDLE_STORAGE_KEY, String(value));
}

function clearIdleState() {
    localStorage.removeItem(IDLE_STORAGE_KEY);
}

function clearIdleTimer() {
    if (idleTimeoutObj) {
        clearTimeout(idleTimeoutObj);
        idleTimeoutObj = null;
    }
}

function redirectToLogout() {
    clearIdleState();
    window.location.replace('/logout');
}

function scheduleLogout() {
    if (!shouldTrackIdle()) {
        return;
    }

    clearIdleTimer();

    var remainingMs = Math.max(IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt), 0);
    idleTimeoutObj = setTimeout(function () {
        if (Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) {
            // Keep UI preferences (theme/unit/refresh) while ending auth session.
            localStorage.removeItem('username');
            redirectToLogout();
            return;
        }

        scheduleLogout();
    }, remainingMs);
}

function markActivity() {
    if (!shouldTrackIdle()) {
        return;
    }

    lastActivityAt = Date.now();
    persistLastActivityAt(lastActivityAt);
    scheduleLogout();
}

function handleMouseMove() {
    var now = Date.now();
    if (now - lastMouseReset < MOUSEMOVE_THROTTLE_MS) {
        return;
    }
    lastMouseReset = now;
    markActivity();
}



async function postUsername() {
    var response = await fetch('/api/b2f/user', {
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
            username: localStorage.getItem('username')
        }),
        headers: {
            'Content-type': 'application/json'
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            clearIdleState();
            window.location.href = '/login';
            throw new Error('Authentication required. Redirecting to login...');
        }
        throw new Error('Heartbeat failed with status ' + response.status);
    }
}

function startHeartbeatLoop() {
    if (!shouldTrackIdle()) {
        return;
    }

    postUsername().catch(function () {
        // Errors are handled in postUsername (401 redirects).
    });

    if (heartbeatIntervalObj) {
        clearInterval(heartbeatIntervalObj);
    }

    heartbeatIntervalObj = setInterval(function () {
        postUsername().catch(function () {
            // Keep loop alive; authentication flow handles failures.
        });
    }, HEARTBEAT_INTERVAL_MS);
}

function syncActivityFromOtherTabs(event) {
    if (event.key !== IDLE_STORAGE_KEY) {
        return;
    }

    var updatedAt = Number(event.newValue);
    if (Number.isFinite(updatedAt) && updatedAt > 0) {
        lastActivityAt = updatedAt;
        scheduleLogout();
    }
}

function handleVisibilityChange() {
    if (!shouldTrackIdle()) {
        return;
    }

    if (!document.hidden) {
        markActivity();
    }
}




document.addEventListener('click', markActivity);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('keydown', markActivity);
document.addEventListener('pointerdown', markActivity);
document.addEventListener('touchstart', markActivity, { passive: true });
document.addEventListener('scroll', markActivity, { passive: true });
document.addEventListener('focus', markActivity, true);
window.addEventListener('storage', syncActivityFromOtherTabs);
document.addEventListener('visibilitychange', handleVisibilityChange);

// Start the timer when an authenticated page loads.
lastActivityAt = readLastActivityAt();
persistLastActivityAt(lastActivityAt);
scheduleLogout();
startHeartbeatLoop();
