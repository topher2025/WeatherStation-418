// ========== History Page JavaScript ==========

const CONFIG = {
    apiBaseUrl: '/api',
};

const DEFAULT_SETTINGS = {
    theme: 'dark',
    tempUnit: 'celsius',
    refreshInterval: 5,
};

let settings = { ...DEFAULT_SETTINGS };
let historyRefreshInterval = null;

// Initialization
document.addEventListener('DOMContentLoaded', function () {
    settings = loadSettings();
    applyTheme(settings.theme);
    loadHistoryData();
    configureAutoRefresh(settings.refreshInterval);
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
});

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
    if (historyRefreshInterval) {
        clearInterval(historyRefreshInterval);
    }

    historyRefreshInterval = setInterval(loadHistoryData, refreshSeconds * 1000);
}

function cToF(value) {
    return (value * 9) / 5 + 32;
}

function formatTempLabel(celsiusValue) {
    if (settings.tempUnit === 'fahrenheit') {
        return `${cToF(celsiusValue).toFixed(1)}${String.fromCharCode(176)}F`;
    }
    if (settings.tempUnit === 'both') {
        return `${celsiusValue.toFixed(1)}${String.fromCharCode(176)}C / ${cToF(celsiusValue).toFixed(1)}${String.fromCharCode(176)}F`;
    }
    return `${celsiusValue.toFixed(1)}${String.fromCharCode(176)}C`;
}

function temperatureColumnTitle() {
    if (settings.tempUnit === 'fahrenheit') {
        return 'Temperature (F)';
    }
    if (settings.tempUnit === 'both') {
        return 'Temperature (C/F)';
    }
    return 'Temperature (C)';
}

window.addEventListener('storage', function (event) {
    if (!['theme', 'tempUnit', 'refreshInterval'].includes(event.key)) {
        return;
    }

    settings = loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);
    loadHistoryData();
});

window.addEventListener('settings-updated', function (event) {
    settings = event.detail || loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);
    loadHistoryData();
});

// Fetch and display historical data
async function loadHistoryData() {
    try {
        console.log('Fetching historical data for past 24 hours...');
        
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/hourly?hours=24`);
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            if (response.status === 404) {
                showError('No historical data available yet.');
                return;
            }
            throw new Error(`Failed to fetch historical data (${response.status}).`);
        }

        const hourlyData = await response.json();
        
        if (!Array.isArray(hourlyData) || hourlyData.length === 0) {
            showError('No historical weather data available yet.');
            return;
        }

        displayHistoricalTable(hourlyData);
        displayStatistics(hourlyData);

    } catch (error) {
        console.error('Error loading history:', error);
        showError(error.message || 'Failed to load historical data');
    }
}

function convertToLocalTime(utcTimestamp) {
    const date = new Date(utcTimestamp);
    return date.toLocaleString();
}

function displayHistoricalTable(data) {
    const container = document.getElementById('history-container');
    
    // Create table
    let html = '<table class="history-table"><thead><tr>';
    html += '<th>Timestamp (Local)</th>';
    html += `<th>${temperatureColumnTitle()}</th>`;
    html += '<th>Humidity (%)</th>';
    html += '<th>Pressure (hPa)</th>';
    html += '<th>Gas Resistance (Ω)</th>';
    html += '</tr></thead><tbody>';
    
    // Add rows in reverse chronological order (newest first)
    for (let i = data.length - 1; i >= 0; i--) {
        const record = data[i];
        const localTime = convertToLocalTime(record.timestamp);
        html += '<tr>';
        html += `<td>${localTime}</td>`;
        html += `<td>${formatTempLabel(record.temperature)}</td>`;
        html += `<td>${record.humidity.toFixed(1)}</td>`;
        html += `<td>${record.pressure.toFixed(1)}</td>`;
        html += `<td>${record.gas_resistance.toFixed(0)}</td>`;
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayStatistics(data) {
    if (!Array.isArray(data) || data.length === 0) return;

    // Temperature statistics
    const temperatures = data.map(d => d.temperature);
    const tempAvg = (temperatures.reduce((a, b) => a + b) / temperatures.length);
    const tempHigh = Math.max(...temperatures);
    const tempLow = Math.min(...temperatures);
    const tempRange = tempHigh - tempLow || 1;

    document.getElementById('temp-24h-avg').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: ${((tempAvg - tempLow) / tempRange) * 100}%">
                ${formatTempLabel(tempAvg)}
            </div>
        </div>
    `;
    
    document.getElementById('temp-24h-high').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: 100%">
                ${formatTempLabel(tempHigh)}
            </div>
        </div>
    `;
    
    document.getElementById('temp-24h-low').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: ${(tempLow / tempHigh) * 100}%; background: linear-gradient(90deg, #3498db, #2980b9);">
                ${formatTempLabel(tempLow)}
            </div>
        </div>
    `;

    // Humidity statistics
    const humidities = data.map(d => d.humidity);
    const humidityAvg = (humidities.reduce((a, b) => a + b) / humidities.length);
    const humidityHigh = Math.max(...humidities);
    const humidityLow = Math.min(...humidities);

    document.getElementById('humidity-24h-avg').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: ${humidityAvg}%">
                ${humidityAvg.toFixed(1)}%
            </div>
        </div>
    `;
    
    document.getElementById('humidity-24h-high').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: 100%">
                ${humidityHigh.toFixed(1)}%
            </div>
        </div>
    `;
    
    document.getElementById('humidity-24h-low').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: ${(humidityLow / 100) * 100}%; background: linear-gradient(90deg, #3498db, #2980b9);">
                ${humidityLow.toFixed(1)}%
            </div>
        </div>
    `;

    // Pressure statistics
    const pressures = data.map(d => d.pressure);
    const pressureAvg = (pressures.reduce((a, b) => a + b) / pressures.length);
    const pressureHigh = Math.max(...pressures);
    const pressureLow = Math.min(...pressures);
    const pressureRange = pressureHigh - pressureLow || 1;

    document.getElementById('pressure-24h-avg').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: ${((pressureAvg - pressureLow) / pressureRange) * 100}%">
                ${pressureAvg.toFixed(1)} hPa
            </div>
        </div>
    `;
    
    document.getElementById('pressure-24h-high').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: 100%">
                ${pressureHigh.toFixed(1)} hPa
            </div>
        </div>
    `;
    
    document.getElementById('pressure-24h-low').innerHTML = `
        <div class="trend-bar">
            <div class="trend-bar-fill" style="width: ${(pressureLow / pressureHigh) * 100}%; background: linear-gradient(90deg, #3498db, #2980b9);">
                ${pressureLow.toFixed(1)} hPa
            </div>
        </div>
    `;
}

function updateLastUpdatedTime() {
    const element = document.getElementById('last-updated');
    if (element) {
        const now = new Date();
        element.textContent = now.toLocaleTimeString();
    }
}

function showError(message) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Cleanup
window.addEventListener('beforeunload', function () {
    if (historyRefreshInterval) {
        clearInterval(historyRefreshInterval);
    }
});
