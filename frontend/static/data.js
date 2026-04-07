// ========== Data Report Page JavaScript ===
const CONFIG = {
    apiBaseUrl: '/api',
};

const MAX_CHART_POINTS = 1200;

const chartInstances = {};

document.addEventListener('DOMContentLoaded', function () {
    initializeDataPage();
});

function initializeDataPage() {
    const hoursSelect = document.getElementById('report-hours');
    const refreshBtn = document.getElementById('refresh-report-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const defaultRange = String(document.body.dataset.defaultRange || '24');

    if (hoursSelect) {
        hoursSelect.value = defaultRange;
        hoursSelect.addEventListener('change', () => loadReportData(hoursSelect.value));
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadReportData(getSelectedRange()));
    }

    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', () => downloadReport('csv'));
    }

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => downloadReport('pdf'));
    }

    loadReportData(defaultRange);
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
}

function getSelectedRange() {
    const hoursSelect = document.getElementById('report-hours');
    return String(hoursSelect?.value || '24');
}

async function loadReportData(rangeValue) {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/hourly?hours=${encodeURIComponent(rangeValue)}`);

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (response.status === 404) {
            showError('No historical data available yet.');
            clearCharts();
            renderSummary([], rangeValue, 0);
            return;
        }

        if (!response.ok) {
            showError(`Failed to load report data (${response.status}).`);
            clearCharts();
            renderSummary([], rangeValue, 0);
            return;
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            showError('No historical weather data available yet.');
            clearCharts();
            renderSummary([], rangeValue, 0);
            return;
        }

        const chartRows = downsampleRowsForCharts(data, MAX_CHART_POINTS);
        renderSummary(data, rangeValue, chartRows.length);
        renderCharts(chartRows);
    } catch (error) {
        console.error('Error loading report data:', error);
        showError(error.message || 'Failed to load report data');
    }
}

function renderSummary(data, rangeValue, plottedCount) {
    const container = document.getElementById('report-summary');
    if (!container) return;

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div class="loading">No report data available for the selected range.</div>';
        return;
    }

    const firstReading = data[0];
    const lastReading = data[data.length - 1];

    container.innerHTML = `
        <div class="report-summary-grid">
            <div class="summary-item">
                <div class="summary-label">Readings</div>
                <div class="summary-value">${data.length}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Range</div>
                <div class="summary-value">${formatRangeLabel(rangeValue)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">First Reading</div>
                <div class="summary-value">${formatTimestamp(firstReading.timestamp)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Latest Reading</div>
                <div class="summary-value">${formatTimestamp(lastReading.timestamp)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Chart Points</div>
                <div class="summary-value">${plottedCount} plotted${plottedCount < data.length ? ` (from ${data.length})` : ''}</div>
            </div>
        </div>
    `;
}


function formatRangeLabel(rangeValue) {
    if (String(rangeValue).toLowerCase() === 'all') {
        return 'All time';
    }
    const numericHours = Number(rangeValue);
    return Number.isFinite(numericHours) ? `Last ${numericHours}h` : 'Selected range';
}


function downsampleRowsForCharts(rows, maxPoints) {
    if (!Array.isArray(rows) || rows.length <= maxPoints) {
        return rows;
    }

    const sampled = [];
    const span = rows.length - 1;
    let lastIndex = -1;

    for (let i = 0; i < maxPoints; i++) {
        const index = Math.round((i * span) / (maxPoints - 1));
        if (index !== lastIndex) {
            sampled.push(rows[index]);
            lastIndex = index;
        }
    }

    if (sampled[sampled.length - 1] !== rows[rows.length - 1]) {
        sampled.push(rows[rows.length - 1]);
    }

    return sampled;
}


function renderCharts(data) {
    clearCharts();

    const labels = data.map((record) => formatTimestamp(record.timestamp));

    chartInstances.temperature = createLineChart('temperature-chart', labels, data.map((record) => Number(record.temperature)), {
        label: 'Temperature (°C)',
        color: '#0ea5e9',
    });

    chartInstances.humidity = createLineChart('humidity-chart', labels, data.map((record) => Number(record.humidity)), {
        label: 'Humidity (%)',
        color: '#10b981',
    });

    chartInstances.pressure = createLineChart('pressure-chart', labels, data.map((record) => Number(record.pressure)), {
        label: 'Pressure (hPa)',
        color: '#f59e0b',
    });

    chartInstances.gas = createLineChart('gas-chart', labels, data.map((record) => Number(record.gas_resistance)), {
        label: 'Gas Resistance (Ω)',
        color: '#f43f5e',
    });
}

function createLineChart(canvasId, labels, values, { label, color }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') {
        return null;
    }

    return new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label,
                    data: values,
                    borderColor: color,
                    backgroundColor: `${color}22`,
                    fill: true,
                    tension: 0.25,
                    pointRadius: values.length > 450 ? 0 : 2,
                    pointHoverRadius: values.length > 450 ? 2 : 4,
                    borderWidth: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e2e8f0',
                    },
                },
                tooltip: {
                    callbacks: {
                        title(context) {
                            return context[0]?.label || '';
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: '#cbd5e1',
                        maxRotation: 45,
                        minRotation: 45,
                        maxTicksLimit: 10,
                    },
                    grid: {
                        color: 'rgba(51, 65, 85, 0.35)',
                    },
                },
                y: {
                    ticks: {
                        color: '#cbd5e1',
                    },
                    grid: {
                        color: 'rgba(51, 65, 85, 0.35)',
                    },
                },
            },
        },
    });
}

function clearCharts() {
    Object.keys(chartInstances).forEach((key) => {
        const chart = chartInstances[key];
        if (chart) {
            chart.destroy();
        }
        delete chartInstances[key];
    });
}

async function downloadReport(format) {
    const rangeValue = getSelectedRange();
    const button = document.getElementById(format === 'csv' ? 'download-csv-btn' : 'download-pdf-btn');

    if (button) {
        button.disabled = true;
    }

    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/report.${format}?hours=${encodeURIComponent(rangeValue)}`);

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const message = await readErrorMessage(response);
            showError(message || `Failed to download report (${response.status}).`);
            return;
        }

        const blob = await response.blob();
        triggerDownload(blob, getDownloadFilename(response, format, rangeValue));
    } catch (error) {
        console.error(`Error downloading ${format.toUpperCase()} report:`, error);
        showError(error.message || `Failed to download ${format.toUpperCase()} report`);
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

function triggerDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

async function readErrorMessage(response) {
    try {
        const payload = await response.json();
        return payload.error || payload.message || null;
    } catch (error) {
        try {
            return await response.text();
        } catch (innerError) {
            return null;
        }
    }
}

function getDownloadFilename(response, format, rangeValue) {
    const contentDisposition = response.headers.get('content-disposition') || '';
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
    }

    if (String(rangeValue).toLowerCase() === 'all') {
        return `weather-report-all-time.${format}`;
    }
    return `weather-report-${rangeValue}h.${format}`;
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

function updateLastUpdatedTime() {
    const element = document.getElementById('last-updated');
    if (element) {
        element.textContent = new Date().toLocaleTimeString();
    }
}

function showError(message) {
    const container = document.querySelector('.container');
    if (!container) return;

    const existingError = container.querySelector('.error');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

