// Only explicit clicks on /logout should end a session.
document.querySelectorAll('a[href="/logout"]').forEach(function (link) {
    link.addEventListener('click', function () {
        link.classList.add('disabled');
        link.setAttribute('aria-disabled', 'true');
    });
});

var IDLE_TIMEOUT_SEC = 15*60;
var IDLE_TIMEOUT_MS = 1000*IDLE_TIMEOUT_SEC;
var MOUSEMOVE_THROTTLE_MS = 500;
var HEARTBEAT_INTERVAL_MS = 5000;
var timeoutObj = null;
var lastMouseReset = 0;
var heartbeatIntervalObj = null;

function shouldTrackIdle() {
    return window.location.pathname !== '/login';
}

function scheduleLogout() {
    if (!shouldTrackIdle()) {
        return;
    }

    if (timeoutObj) {
        clearTimeout(timeoutObj);
    }

    timeoutObj = setTimeout(function () {
        localStorage.clear();
        window.location = '/logout';
    }, IDLE_TIMEOUT_MS);
}

function handleMouseMove() {
    var now = Date.now();
    if (now - lastMouseReset < MOUSEMOVE_THROTTLE_MS) {
        return;
    }
    lastMouseReset = now;
    scheduleLogout();
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




document.addEventListener('click', scheduleLogout);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('keydown', scheduleLogout);
document.addEventListener('scroll', scheduleLogout, { passive: true });

// Start the timer when an authenticated page loads.
scheduleLogout();
startHeartbeatLoop();
