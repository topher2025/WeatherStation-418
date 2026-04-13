const CONFIG = {
    apiBaseUrl: "/api",
};

const DEFAULT_SETTINGS = {
    theme: "dark",
    refreshInterval: 5,
};

let logsRefreshInterval = null;
let lastRenderedLines = [];
let lastSizeBytes = null;
let hasLoadedLogs = false;
let lastRequestedLines = null;

const linesInput = document.getElementById("lines-input");
const refreshButton = document.getElementById("refresh-logs-btn");
const downloadButton = document.getElementById("download-logs-btn");
const logsOutput = document.getElementById("logs-output");
const logsMeta = document.getElementById("logs-meta");

document.addEventListener("DOMContentLoaded", function () {
    const settings = loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);

    refreshButton.addEventListener("click", function () {
        loadLogs({ showLoading: true, forceFull: true });
    });
    downloadButton.addEventListener("click", downloadLogs);
    loadLogs({ showLoading: true, forceFull: true });
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
});

function loadSettings() {
    const storedTheme = localStorage.getItem("theme") || DEFAULT_SETTINGS.theme;
    const storedRefreshSeconds = Number(localStorage.getItem("refreshInterval"));

    return {
        theme: ["dark", "light", "auto"].includes(storedTheme) ? storedTheme : DEFAULT_SETTINGS.theme,
        refreshInterval: Number.isFinite(storedRefreshSeconds)
            ? Math.min(Math.max(storedRefreshSeconds, 1), 60)
            : DEFAULT_SETTINGS.refreshInterval,
    };
}

function applyTheme(theme) {
    if (!document.body) {
        return;
    }

    if (theme === "light") {
        document.body.classList.add("light-theme");
        return;
    }

    if (theme === "auto") {
        const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
        document.body.classList.toggle("light-theme", prefersLight);
        return;
    }

    document.body.classList.remove("light-theme");
}

function configureAutoRefresh(refreshSeconds) {
    if (logsRefreshInterval) {
        clearInterval(logsRefreshInterval);
    }
    logsRefreshInterval = setInterval(function () {
        loadLogs({ showLoading: false, forceFull: false });
    }, refreshSeconds * 1000);
}

function isNearTop(element, thresholdPx = 24) {
    return element.scrollTop <= thresholdPx;
}

function getPrependedCount(previousLines, nextLines) {
    const maxOffset = nextLines.length;
    for (let offset = 0; offset <= maxOffset; offset += 1) {
        const compareLength = Math.min(previousLines.length, nextLines.length - offset);
        if (compareLength <= 0) {
            continue;
        }

        let isMatch = true;
        for (let index = 0; index < compareLength; index += 1) {
            if (previousLines[index] !== nextLines[offset + index]) {
                isMatch = false;
                break;
            }
        }

        if (isMatch) {
            return offset;
        }
    }
    return -1;
}

function renderLogs(lines, sizeBytes, { forceFull = false } = {}) {
    const shouldStickToTop = isNearTop(logsOutput);
    const sizeShrank = Number.isFinite(sizeBytes) && Number.isFinite(lastSizeBytes) && sizeBytes < lastSizeBytes;

    if (!hasLoadedLogs || forceFull || sizeShrank) {
        logsOutput.textContent = lines.length > 0 ? lines.join("\n") : "No logs yet.";
        lastRenderedLines = lines.slice();
        hasLoadedLogs = true;
        lastSizeBytes = sizeBytes;
        if (shouldStickToTop) {
            logsOutput.scrollTop = 0;
        }
        return;
    }

    if (lines.length === 0) {
        if (lastRenderedLines.length !== 0) {
            logsOutput.textContent = "No logs yet.";
            lastRenderedLines = [];
        }
        lastSizeBytes = sizeBytes;
        return;
    }

    const prependedCount = getPrependedCount(lastRenderedLines, lines);
    if (prependedCount >= 0) {
        if (prependedCount > 0) {
            const existingText = logsOutput.textContent === "No logs yet." ? "" : logsOutput.textContent;
            const prependText = lines.slice(0, prependedCount).join("\n");
            const combinedText = existingText ? `${prependText}\n${existingText}` : prependText;
            logsOutput.textContent = combinedText.split("\n").slice(0, lines.length).join("\n");
        } else {
            // Content may still change if line window size changed while keeping the same prefix.
            const targetText = lines.join("\n");
            if (logsOutput.textContent !== targetText) {
                logsOutput.textContent = targetText;
            }
        }

        if (shouldStickToTop) {
            logsOutput.scrollTop = 0;
        }
        lastRenderedLines = lines.slice();
        lastSizeBytes = sizeBytes;
        return;
    }

    // Fallback when overlap cannot be determined (rotation/truncation/window shift).
    logsOutput.textContent = lines.join("\n");
    lastRenderedLines = lines.slice();
    lastSizeBytes = sizeBytes;
    if (shouldStickToTop) {
        logsOutput.scrollTop = 0;
    }
}

window.addEventListener("storage", function (event) {
    if (!["theme", "refreshInterval"].includes(event.key)) {
        return;
    }

    const settings = loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);
});

window.addEventListener("settings-updated", function (event) {
    const settings = event.detail || loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);
});

async function loadLogs(options = {}) {
    const showLoading = Boolean(options.showLoading);
    const forceFull = Boolean(options.forceFull);
    const requestedLines = parseInt(linesInput.value, 10);
    const safeLines = Number.isFinite(requestedLines) && requestedLines > 0 ? requestedLines : 200;
    const lineWindowChanged = lastRequestedLines !== null && safeLines !== lastRequestedLines;
    lastRequestedLines = safeLines;

    if (showLoading && !hasLoadedLogs) {
        logsOutput.textContent = "Loading logs...";
    }

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/logs?lines=${safeLines}&order=desc`);
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
        logsMeta.textContent = `Showing ${lines.length} lines from ${payload.log_file} (${existsLabel}, ${payload.size_bytes} bytes), newest first. Max per request: ${payload.max_lines}.`;
        renderLogs(lines, payload.size_bytes, { forceFull: forceFull || lineWindowChanged });
    } catch (error) {
        logsMeta.textContent = "Unable to load logs.";
        if (!hasLoadedLogs) {
            logsOutput.textContent = error.message || "Unknown error while loading logs.";
        }
    }
}

async function downloadLogs() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/logs/download?order=desc`);
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

window.addEventListener("beforeunload", function () {
    if (logsRefreshInterval) {
        clearInterval(logsRefreshInterval);
    }
});

