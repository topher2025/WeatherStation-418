const CONFIG = {
    apiBaseUrl: "/api",
};

const linesInput = document.getElementById("lines-input");
const refreshButton = document.getElementById("refresh-logs-btn");
const logsOutput = document.getElementById("logs-output");
const logsMeta = document.getElementById("logs-meta");

document.addEventListener("DOMContentLoaded", function () {
    refreshButton.addEventListener("click", loadLogs);
    loadLogs();
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
});

async function loadLogs() {
    const requestedLines = parseInt(linesInput.value, 10);
    const safeLines = Number.isFinite(requestedLines) && requestedLines > 0 ? requestedLines : 200;

    logsOutput.textContent = "Loading logs...";

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/logs?lines=${safeLines}`);
        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch logs (${response.status}).`);
        }

        const payload = await response.json();
        const lines = Array.isArray(payload.lines) ? payload.lines : [];
        logsMeta.textContent = `Showing ${lines.length} lines from ${payload.log_file}. Max per request: ${payload.max_lines}.`;
        logsOutput.textContent = lines.length > 0 ? lines.join("\n") : "No logs yet.";
    } catch (error) {
        logsMeta.textContent = "Unable to load logs.";
        logsOutput.textContent = error.message || "Unknown error while loading logs.";
    }
}

function updateLastUpdatedTime() {
    const element = document.getElementById("last-updated");
    if (!element) {
        return;
    }
    element.textContent = new Date().toLocaleTimeString();
}

