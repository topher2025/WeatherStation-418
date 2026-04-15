// ========== Data Report Page JavaScript ===
const CONFIG = {
    apiBaseUrl: '/api',
};

const DEFAULT_SETTINGS = {
    theme: 'dark',
    tempUnit: 'celsius',
    refreshInterval: 5,
};

const MAX_CHART_POINTS = 1200;
const CHART_CANVAS_IDS = ['temperature-chart', 'humidity-chart', 'pressure-chart', 'gas-chart'];

let settings = { ...DEFAULT_SETTINGS };
let reportRefreshInterval = null;

document.addEventListener('DOMContentLoaded', function () {
    initializeDataPage();
});

function initializeDataPage() {
    settings = loadSettings();
    applyTheme(settings.theme);

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

    configureAutoRefresh(settings.refreshInterval);

    window.addEventListener('storage', function (event) {
        if (!['theme', 'tempUnit', 'refreshInterval'].includes(event.key)) {
            return;
        }

        settings = loadSettings();
        applyTheme(settings.theme);
        configureAutoRefresh(settings.refreshInterval);
        loadReportData(getSelectedRange());
    });

    window.addEventListener('settings-updated', function (event) {
        settings = event.detail || loadSettings();
        applyTheme(settings.theme);
        configureAutoRefresh(settings.refreshInterval);
        loadReportData(getSelectedRange());
    });

    loadReportData(defaultRange);
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
}

function loadSettings() {
    const storedTheme = localStorage.getItem('theme') || DEFAULT_SETTINGS.theme;
    const storedTempUnit = localStorage.getItem('tempUnit') || DEFAULT_SETTINGS.tempUnit;
    const storedRefreshSeconds = Number(localStorage.getItem('refreshInterval'));

    return {
        theme: ['dark', 'light', 'auto'].includes(storedTheme) ? storedTheme : DEFAULT_SETTINGS.theme,
        tempUnit: ['celsius', 'fahrenheit', 'both'].includes(storedTempUnit)
            ? storedTempUnit
            : DEFAULT_SETTINGS.tempUnit,
        refreshInterval: Number.isFinite(storedRefreshSeconds)
            ? Math.min(Math.max(storedRefreshSeconds, 1), 60)
            : DEFAULT_SETTINGS.refreshInterval,
    };
}

function applyTheme(theme) {
    if (!document.body) {
        return;
    }

    if (theme === 'light') {
        document.body.classList.add('light-theme');
        return;
    }

    if (theme === 'auto') {
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        document.body.classList.toggle('light-theme', prefersLight);
        return;
    }

    document.body.classList.remove('light-theme');
}

function configureAutoRefresh(refreshSeconds) {
    if (reportRefreshInterval) {
        clearInterval(reportRefreshInterval);
    }

    reportRefreshInterval = setInterval(() => loadReportData(getSelectedRange()), refreshSeconds * 1000);
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
        clearCharts();
        renderSummary([], rangeValue, 0);
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


function prepareChartCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 0));
    const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 0));
    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    if (canvas.width !== pixelWidth) {
        canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
        canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
}


function drawCenteredMessage(ctx, width, height, message) {
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, width / 2, height / 2);
    ctx.restore();
}


function buildTickIndexes(totalPoints, maxTicks) {
    if (totalPoints <= 1) {
        return [0];
    }

    const safeTickCount = Math.max(2, maxTicks);
    const step = Math.max(1, Math.ceil((totalPoints - 1) / (safeTickCount - 1)));
    const indexes = [];

    for (let index = 0; index < totalPoints; index += step) {
        indexes.push(index);
    }

    if (indexes[indexes.length - 1] !== totalPoints - 1) {
        indexes.push(totalPoints - 1);
    }

    return indexes;
}


function formatChartTimestamp(timestamp) {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
        return String(timestamp ?? '');
    }

    return parsed.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}


function formatAxisValue(value) {
    if (!Number.isFinite(value)) {
        return '';
    }

    const absolute = Math.abs(value);
    if (absolute >= 1000) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }

    if (absolute >= 100) {
        return value.toFixed(1);
    }

    return value.toFixed(1);
}


function drawChartGrid(ctx, chartArea, minValue, maxValue, labels) {
    const yTicks = 5;
    const xTickIndexes = buildTickIndexes(labels.length, 8);

    ctx.save();
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= yTicks; i += 1) {
        const ratio = i / yTicks;
        const y = chartArea.top + chartArea.height * ratio;
        const value = maxValue - (maxValue - minValue) * ratio;

        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatAxisValue(value), chartArea.left - 10, y);
    }

    xTickIndexes.forEach((index) => {
        const x = labels.length === 1
            ? chartArea.left + chartArea.width / 2
            : chartArea.left + (chartArea.width * index) / (labels.length - 1);

        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();

        ctx.save();
        ctx.translate(x, chartArea.bottom + 14);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[index], 0, 0);
        ctx.restore();
    });

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.beginPath();
    ctx.moveTo(chartArea.left, chartArea.top);
    ctx.lineTo(chartArea.left, chartArea.bottom);
    ctx.lineTo(chartArea.right, chartArea.bottom);
    ctx.stroke();

    ctx.restore();
}


function drawSeries(ctx, chartArea, values, minValue, maxValue, dataset) {
    const points = values
        .map((value, index) => ({ value: Number(value), index }))
        .filter((point) => Number.isFinite(point.value));

    if (points.length === 0) {
        return;
    }

    const seriesPoints = points.map((point) => {
        const x = points.length === 1
            ? chartArea.left + chartArea.width / 2
            : chartArea.left + (chartArea.width * point.index) / (values.length - 1);
        const ratio = (point.value - minValue) / (maxValue - minValue || 1);
        const y = chartArea.bottom - chartArea.height * ratio;
        return { x, y, value: point.value };
    });

    const strokeColor = dataset.borderColor || '#0ea5e9';
    const fillColor = dataset.backgroundColor || 'rgba(14, 165, 233, 0.15)';
    const lineWidth = dataset.borderWidth || 2;
    const shouldDrawPoints = (dataset.pointRadius ?? 2) > 0;
    const pointRadius = dataset.pointRadius ?? 2;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (dataset.fill) {
        ctx.beginPath();
        ctx.moveTo(seriesPoints[0].x, chartArea.bottom);
        seriesPoints.forEach((point) => {
            ctx.lineTo(point.x, point.y);
        });
        ctx.lineTo(seriesPoints[seriesPoints.length - 1].x, chartArea.bottom);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    ctx.beginPath();
    seriesPoints.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (shouldDrawPoints) {
        ctx.fillStyle = strokeColor;
        seriesPoints.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    ctx.restore();
}


function drawLegend(ctx, chartArea, datasets) {
    if (datasets.length <= 1) {
        return;
    }

    ctx.save();
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';

    let cursorX = chartArea.left;
    const y = chartArea.top - 16;

    datasets.forEach((dataset) => {
        const color = dataset.borderColor || '#0ea5e9';
        const label = dataset.label || '';
        const labelWidth = ctx.measureText(label).width;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cursorX, y);
        ctx.lineTo(cursorX + 18, y);
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'left';
        ctx.fillText(label, cursorX + 24, y);

        cursorX += 24 + labelWidth + 20;
    });

    ctx.restore();
}


function renderChartCanvas(canvasId, labels, datasets) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return null;
    }

    const prepared = prepareChartCanvas(canvas);
    if (!prepared) {
        return null;
    }

    const { ctx, width, height } = prepared;
    ctx.clearRect(0, 0, width, height);

    if (!Array.isArray(labels) || labels.length === 0 || !Array.isArray(datasets) || datasets.length === 0) {
        drawCenteredMessage(ctx, width, height, 'No chart data available.');
        return null;
    }

    const normalizedDatasets = datasets.map((dataset) => ({
        ...dataset,
        values: Array.isArray(dataset.values) ? dataset.values.map((value) => Number(value)) : [],
    }));
    const allValues = normalizedDatasets.flatMap((dataset) => dataset.values.filter(Number.isFinite));

    if (allValues.length === 0) {
        drawCenteredMessage(ctx, width, height, 'No chart data available.');
        return null;
    }

    let minValue = Math.min(...allValues);
    let maxValue = Math.max(...allValues);

    if (minValue === maxValue) {
        const delta = Math.abs(minValue) || 1;
        minValue -= delta * 0.5;
        maxValue += delta * 0.5;
    } else {
        const margin = (maxValue - minValue) * 0.1;
        minValue -= margin;
        maxValue += margin;
    }

    const chartArea = {
        left: 64,
        right: width - 18,
        top: normalizedDatasets.length > 1 ? 44 : 20,
        bottom: height - 54,
    };
    chartArea.width = chartArea.right - chartArea.left;
    chartArea.height = chartArea.bottom - chartArea.top;

    if (chartArea.width <= 0 || chartArea.height <= 0) {
        drawCenteredMessage(ctx, width, height, 'Chart area is too small to render.');
        return null;
    }

    drawChartGrid(ctx, chartArea, minValue, maxValue, labels);
    drawLegend(ctx, chartArea, normalizedDatasets);
    normalizedDatasets.forEach((dataset) => {
        drawSeries(ctx, chartArea, dataset.values, minValue, maxValue, dataset);
    });

    return null;
}


function renderCharts(data) {
    clearCharts();

    const labels = data.map((record) => formatChartTimestamp(record.timestamp));
    if (settings.tempUnit === 'both') {
        renderChartCanvas('temperature-chart', labels, [
            {
                label: 'Temperature (°C)',
                values: data.map((record) => Number(record.temperature)),
                borderColor: '#0ea5e9',
                backgroundColor: '#0ea5e922',
                fill: true,
                pointRadius: data.length > 450 ? 0 : 2,
                borderWidth: 2,
            },
            {
                label: 'Temperature (°F)',
                values: data.map((record) => cToF(Number(record.temperature))),
                borderColor: '#f97316',
                backgroundColor: '#f9731622',
                fill: true,
                pointRadius: data.length > 450 ? 0 : 2,
                borderWidth: 2,
            },
        ]);
    } else {
        renderChartCanvas('temperature-chart', labels, [
            {
                label: settings.tempUnit === 'fahrenheit' ? 'Temperature (°F)' : 'Temperature (°C)',
                values: data.map((record) => {
                    const celsius = Number(record.temperature);
                    return settings.tempUnit === 'fahrenheit' ? cToF(celsius) : celsius;
                }),
                borderColor: '#0ea5e9',
                backgroundColor: '#0ea5e922',
                fill: true,
                pointRadius: data.length > 450 ? 0 : 2,
                borderWidth: 2,
            },
        ]);
    }

    renderChartCanvas('humidity-chart', labels, [{
        label: 'Humidity (%)',
        values: data.map((record) => Number(record.humidity)),
        borderColor: '#10b981',
        backgroundColor: '#10b98122',
        fill: true,
        pointRadius: data.length > 450 ? 0 : 2,
        borderWidth: 2,
    }]);

    renderChartCanvas('pressure-chart', labels, [{
        label: 'Pressure (hPa)',
        values: data.map((record) => Number(record.pressure)),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b22',
        fill: true,
        pointRadius: data.length > 450 ? 0 : 2,
        borderWidth: 2,
    }]);

    renderChartCanvas('gas-chart', labels, [{
        label: 'Gas Resistance (Ω)',
        values: data.map((record) => Number(record.gas_resistance)),
        borderColor: '#f43f5e',
        backgroundColor: '#f43f5e22',
        fill: true,
        pointRadius: data.length > 450 ? 0 : 2,
        borderWidth: 2,
    }]);
}

function cToF(value) {
    return (value * 9) / 5 + 32;
}

function clearCharts() {
    CHART_CANVAS_IDS.forEach((canvasId) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return;
        }

        const prepared = prepareChartCanvas(canvas);
        if (!prepared) {
            return;
        }

        const { ctx, width, height } = prepared;
        ctx.clearRect(0, 0, width, height);
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

window.addEventListener('beforeunload', function () {
    if (reportRefreshInterval) {
        clearInterval(reportRefreshInterval);
    }
});

