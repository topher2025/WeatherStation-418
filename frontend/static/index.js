// ========== Weather Dashboard JavaScript ==========

// Configuration
const CONFIG = {
    apiBaseUrl: '/api', // Use relative path to backend on same host
    updateInterval: 5000, // Update every 5 seconds
    chartUpdateInterval: 5000, // Update trends every 5 seconds
};

const DEFAULT_SETTINGS = {
    theme: 'dark',
    tempUnit: 'celsius',
    refreshInterval: 5,
};

// State
let currentWeatherData = null;
let historicalData = null;
let autoUpdateInterval = null;
let chartUpdateInterval = null;
let settings = { ...DEFAULT_SETTINGS };

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function () {
    initializeDashboard();
});

function initializeDashboard() {
    console.log('Initializing Weather Dashboard...');

    settings = loadSettings();
    applyTheme(settings.theme);
    
    // Fetch initial data
    fetchCurrentWeather();
    fetchHistoricalData();
    
    // Set up auto-refresh
    configureAutoRefresh(settings.refreshInterval);
    
    // Update last updated timestamp
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000); // Every minute
    
    // Ensure stats card is initialized
    console.log('Dashboard initialization complete');
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
    const refreshMs = refreshSeconds * 1000;

    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
    if (chartUpdateInterval) {
        clearInterval(chartUpdateInterval);
    }

    autoUpdateInterval = setInterval(fetchCurrentWeather, refreshMs);
    chartUpdateInterval = setInterval(fetchHistoricalData, refreshMs);
}

function cToF(value) {
    return (value * 9) / 5 + 32;
}

function formatTempParts(celsiusValue) {
    if (settings.tempUnit === 'fahrenheit') {
        return {
            value: cToF(celsiusValue).toFixed(1),
            unit: 'F',
        };
    }

    if (settings.tempUnit === 'both') {
        return {
            value: `${celsiusValue.toFixed(1)} / ${cToF(celsiusValue).toFixed(1)}`,
            unit: 'C/F',
        };
    }

    return {
        value: celsiusValue.toFixed(1),
        unit: 'C',
    };
}

function formatTempLabel(celsiusValue) {
    const parts = formatTempParts(celsiusValue);
    return `${parts.value}${String.fromCharCode(176)}${parts.unit}`;
}

window.addEventListener('storage', function (event) {
    if (!['theme', 'tempUnit', 'refreshInterval'].includes(event.key)) {
        return;
    }

    settings = loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);
    if (currentWeatherData) {
        updateCurrentWeatherDisplay(currentWeatherData);
    }
    if (historicalData) {
        updateHistoricalDisplay(historicalData);
    }
});

window.addEventListener('settings-updated', function (event) {
    settings = event.detail || loadSettings();
    applyTheme(settings.theme);
    configureAutoRefresh(settings.refreshInterval);
    if (currentWeatherData) {
        updateCurrentWeatherDisplay(currentWeatherData);
    }
    if (historicalData) {
        updateHistoricalDisplay(historicalData);
    }
});

// ========== Data Fetching ==========
async function fetchCurrentWeather() {
    try {
        console.log('Fetching current weather data...');
        currentWeatherData = await fetchLatestWeatherFromApi();
        updateCurrentWeatherDisplay(currentWeatherData);

    } catch (error) {
        console.error('Error fetching current weather:', error);
        showError(error.message || 'Failed to fetch current weather data');
    }
}

async function fetchHistoricalData() {
    try {
        console.log('Fetching historical data...');

        const hourlyData = await fetchHourlyWeatherFromApi(24);
        console.log('Raw hourly data:', hourlyData);
        
        historicalData = processHistoricalData(hourlyData);
        console.log('Processed historical data:', historicalData);

        if (!historicalData) {
            console.warn('No historical data processed');
            showError('No historical weather data available yet.');
            return;
        }

        console.log('Updating displays with data:', historicalData);
        updateHistoricalDisplay(historicalData);

    } catch (error) {
        console.error('Error fetching historical data:', error);
        showError(error.message || 'Failed to fetch historical data');
    }
}

async function fetchLatestWeatherFromApi() {
    const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/update`);

    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('Authentication required. Redirecting to login...');
        }
        if (response.status === 404) {
            throw new Error('No weather data available yet. Waiting for first sensor reading...');
        }
        throw new Error(`Failed to fetch current weather (${response.status}).`);
    }

    return response.json();
}

async function fetchHourlyWeatherFromApi(hours) {
    const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/hourly?hours=${hours}`);

    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('Authentication required. Redirecting to login...');
        }
        if (response.status === 404) {
            throw new Error('No historical data available yet.');
        }
        throw new Error(`Failed to fetch historical weather (${response.status}).`);
    }

    return response.json();
}

// ========== Data Processing ==========
function processHistoricalData(weatherArray) {
    if (!Array.isArray(weatherArray) || weatherArray.length === 0) {
        console.warn('Weather array is empty or not an array:', weatherArray);
        return null;
    }
    
    console.log('Processing', weatherArray.length, 'weather records');
    
    const temperatures = weatherArray.map(d => d.temperature);
    const humidities = weatherArray.map(d => d.humidity);
    const pressures = weatherArray.map(d => d.pressure);
    
    const processed = {
        tempTrend: temperatures,
        humidityTrend: humidities,
        pressureTrend: pressures,
        tempAvg: temperatures.reduce((a, b) => a + b) / temperatures.length,
        tempHigh: Math.max(...temperatures),
        tempLow: Math.min(...temperatures),
        humidityAvg: humidities.reduce((a, b) => a + b) / humidities.length,
        humidityHigh: Math.max(...humidities),
        humidityLow: Math.min(...humidities),
        pressureAvg: pressures.reduce((a, b) => a + b) / pressures.length,
        pressureHigh: Math.max(...pressures),
        pressureLow: Math.min(...pressures),
    };
    
    console.log('Processed data:', processed);
    return processed;
}

// ========== Display Updates ==========
function updateCurrentWeatherDisplay(data) {
    if (!data) return;
    
    const tempElement = document.getElementById('current-temp');
    const humidityElement = document.getElementById('current-humidity');
    const pressureElement = document.getElementById('current-pressure');
    const gasElement = document.getElementById('current-gas');
    
    if (tempElement) {
        const temperature = Number(data.temperature || 0);
        const tempDisplay = formatTempParts(temperature);
        tempElement.innerHTML = `
            <div class="weather-value">${tempDisplay.value}</div>
            <div class="weather-unit">${String.fromCharCode(176)}${tempDisplay.unit}</div>
        `;
    }
    
    if (humidityElement) {
        humidityElement.innerHTML = `
            <div class="weather-label">Hum</div>
            <div class="weather-value">${(data.humidity || 0).toFixed(1)}</div>
            <div class="weather-unit">%</div>
        `;
    }
    
    if (pressureElement) {
        pressureElement.innerHTML = `
            <div class="weather-label">Press</div>
            <div class="weather-value">${(data.pressure || 0).toFixed(0)}</div>
            <div class="weather-unit">hPa</div>
        `;
    }
    
    if (gasElement) {
        gasElement.innerHTML = `
            <div class="weather-label">Gas</div>
            <div class="weather-value">${(data.gas_resistance || 0).toFixed(0)}</div>
            <div class="weather-unit">Ω</div>
        `;
    }
}

function updateHistoricalDisplay(data) {
    if (!data) {
        console.error('updateHistoricalDisplay called with null data');
        return;
    }
    
    console.log('=== UPDATING HISTORICAL DISPLAY ===');
    console.log('Data received:', data);
    
    const trendsContainer = document.getElementById('trends-container');
    if (!trendsContainer) {
        console.error('trends-container not found');
        return;
    }
    
    // Update temperature trend
    if (data.tempTrend) {
        const tempTrendElement = document.getElementById('temp-trend');
        if (tempTrendElement) {
            const tempRange = Math.max(data.tempHigh - data.tempLow, 1);
            
            tempTrendElement.innerHTML = `
                <div class="trend-bar">
                    <div class="trend-bar-fill" style="width: ${((data.tempAvg - data.tempLow) / tempRange) * 100}%">
                        ${formatTempLabel(data.tempAvg)}
                    </div>
                </div>
                <small>Min: ${formatTempLabel(data.tempLow)} | Max: ${formatTempLabel(data.tempHigh)}</small>
            `;
        }
    }
    
    // Update humidity trend
    if (data.humidityTrend) {
        const humidityTrendElement = document.getElementById('humidity-trend');
        if (humidityTrendElement) {
            humidityTrendElement.innerHTML = `
                <div class="trend-bar">
                    <div class="trend-bar-fill" style="width: ${data.humidityAvg}%">
                        ${data.humidityAvg.toFixed(1)}%
                    </div>
                </div>
                <small>Min: ${data.humidityLow.toFixed(1)}% | Max: ${data.humidityHigh.toFixed(1)}%</small>
            `;
        }
    }
    
    // Update pressure trend
    if (data.pressureTrend) {
        const pressureTrendElement = document.getElementById('pressure-trend');
        if (pressureTrendElement) {
            const pressureRange = Math.max(data.pressureHigh - data.pressureLow, 1);
            
            pressureTrendElement.innerHTML = `
                <div class="trend-bar">
                    <div class="trend-bar-fill" style="width: ${((data.pressureAvg - data.pressureLow) / pressureRange) * 100}%">
                        ${data.pressureAvg.toFixed(1)} hPa
                    </div>
                </div>
                <small>Min: ${data.pressureLow.toFixed(1)} hPa | Max: ${data.pressureHigh.toFixed(1)} hPa</small>
            `;
        }
    }
    
    // Update stats card with actual data
    console.log('Calling updateStatsCard with:', data);
    updateStatsCard(data);
    console.log('=== HISTORICAL DISPLAY UPDATE COMPLETE ===');
}

function updateStatsCard(data) {
    console.log('=== STATS CARD UPDATE START ===');
    console.log('Data object:', data);
    
    if (!data) {
        console.warn('No data provided to updateStatsCard');
        return false;
    }
    
    // Verify all required fields exist
    const hasRequiredFields = data.hasOwnProperty('tempHigh') && 
                             data.hasOwnProperty('tempLow') && 
                             data.hasOwnProperty('humidityAvg');
    
    if (!hasRequiredFields) {
        console.error('Missing required fields:', {
            hasTempHigh: data.hasOwnProperty('tempHigh'),
            hasTempLow: data.hasOwnProperty('tempLow'),
            hasHumidityAvg: data.hasOwnProperty('humidityAvg')
        });
        return false;
    }
    
    console.log('Values to display:', {
        tempHigh: data.tempHigh,
        tempLow: data.tempLow,
        humidityAvg: data.humidityAvg
    });
    
    let successCount = 0;
    
    // Temperature High
    const tempHighElement = document.getElementById('stat-temp-high');
    if (tempHighElement) {
        try {
            const barWidth = Math.min((data.tempHigh / 50) * 100, 100);
            const html = `<div class="trend-bar"><div class="trend-bar-fill" style="width: ${barWidth}%">${formatTempLabel(data.tempHigh)}</div></div>`;
            tempHighElement.innerHTML = html;
            console.log('✓ stat-temp-high updated:', html);
            successCount++;
        } catch (e) {
            console.error('Error updating stat-temp-high:', e);
        }
    } else {
        console.error('stat-temp-high element not found in DOM');
    }
    
    // Temperature Low
    const tempLowElement = document.getElementById('stat-temp-low');
    if (tempLowElement) {
        try {
            const barWidth = Math.min((data.tempLow / 50) * 100, 100);
            const html = `<div class="trend-bar"><div class="trend-bar-fill" style="width: ${barWidth}%; background: linear-gradient(90deg, #3498db, #2980b9);">${formatTempLabel(data.tempLow)}</div></div>`;
            tempLowElement.innerHTML = html;
            console.log('✓ stat-temp-low updated:', html);
            successCount++;
        } catch (e) {
            console.error('Error updating stat-temp-low:', e);
        }
    } else {
        console.error('stat-temp-low element not found in DOM');
    }
    
    // Humidity Average
    const humidityAvgElement = document.getElementById('stat-humidity-avg');
    if (humidityAvgElement) {
        try {
            const html = `<div class="trend-bar"><div class="trend-bar-fill" style="width: ${data.humidityAvg}%">${data.humidityAvg.toFixed(1)}%</div></div>`;
            humidityAvgElement.innerHTML = html;
            console.log('✓ stat-humidity-avg updated:', html);
            successCount++;
        } catch (e) {
            console.error('Error updating stat-humidity-avg:', e);
        }
    } else {
        console.error('stat-humidity-avg element not found in DOM');
    }
    
    console.log(`=== STATS CARD UPDATE COMPLETE: ${successCount}/3 elements updated ===`);
    return successCount === 3;
}

// ========== Utility Functions ==========
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
    
    // Remove error after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}


// ========== Cleanup ==========
window.addEventListener('beforeunload', function () {
    if (autoUpdateInterval) clearInterval(autoUpdateInterval);
    if (chartUpdateInterval) clearInterval(chartUpdateInterval);
});
