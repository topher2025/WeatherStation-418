const CONFIG = {
    apiBaseUrl: "/api",
};

const linesInput = document.getElementById("lines-input");
const refreshButton = document.getElementById("refresh-logs-btn");
const downloadButton = document.getElementById("download-logs-btn");
const logsOutput = document.getElementById("logs-output");
const logsMeta = document.getElementById("logs-meta");

document.addEventListener("DOMContentLoaded", function () {
    refreshButton.addEventListener("click", loadLogs);
    downloadButton.addEventListener("click", downloadLogs);
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
        const existsLabel = payload.exists ? "exists" : "not created yet";
        logsMeta.textContent = `Showing ${lines.length} lines from ${payload.log_file} (${existsLabel}, ${payload.size_bytes} bytes). Max per request: ${payload.max_lines}.`;
        logsOutput.textContent = lines.length > 0 ? lines.join("\n") : "No logs yet.";
    } catch (error) {
        logsMeta.textContent = "Unable to load logs.";
        logsOutput.textContent = error.message || "Unknown error while loading logs.";
    }
}

async function downloadLogs() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/logs/download`);
        if (response.status === 401) {
            window.location.href = "/login";
            return;
        }
        if (!response.ok) {
            let message = `Failed to download logs (${response.status}).`;
            try {
                const errorPayload = await response.json();
                if (errorPayload && errorPayload.error) {
                    message = errorPayload.error;
                }
            } catch (_ignored) {
                // Ignore parse failure and keep generic message.
            }
            throw new Error(message);
        }

        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") || "";
        const fileMatch = disposition.match(/filename="?([^";]+)"?/i);
        const fileName = fileMatch ? fileMatch[1] : "weatherstation.log";

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        logsMeta.textContent = `Download failed: ${error.message || "Unknown error"}`;
    }
}

function updateLastUpdatedTime() {
    const element = document.getElementById("last-updated");
    if (!element) {
        return;
    }
    element.textContent = new Date().toLocaleTimeString();
}

