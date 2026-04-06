// ========== Settings Page JavaScript ==========

const CONFIG = {
    apiBaseUrl: '/api',
};

const DEFAULT_SETTINGS = {
    theme: 'dark',
    tempUnit: 'celsius',
    refreshInterval: 5,
    altitude: 0,
};

const STORAGE_KEYS = {
    theme: 'theme',
    tempUnit: 'tempUnit',
    refreshInterval: 'refreshInterval',
    altitude: 'altitude',
};

// Initialization
document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    applyTheme(getStoredSettings().theme);
    loadSystemInfo();
    setupEventListeners();
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
});

function getStoredSettings() {
    const rawTheme = localStorage.getItem(STORAGE_KEYS.theme) || DEFAULT_SETTINGS.theme;
    const rawTempUnit = localStorage.getItem(STORAGE_KEYS.tempUnit) || DEFAULT_SETTINGS.tempUnit;
    const rawRefreshInterval = Number(localStorage.getItem(STORAGE_KEYS.refreshInterval));
    const rawAltitude = Number(localStorage.getItem(STORAGE_KEYS.altitude));

    const theme = ['dark', 'light', 'auto'].includes(rawTheme) ? rawTheme : DEFAULT_SETTINGS.theme;
    const tempUnit = ['celsius', 'fahrenheit', 'both'].includes(rawTempUnit)
        ? rawTempUnit
        : DEFAULT_SETTINGS.tempUnit;

    const refreshInterval = Number.isFinite(rawRefreshInterval)
        ? Math.min(Math.max(rawRefreshInterval, 1), 60)
        : DEFAULT_SETTINGS.refreshInterval;

    const altitude = Number.isFinite(rawAltitude)
        ? Math.min(Math.max(rawAltitude, -500), 10000)
        : DEFAULT_SETTINGS.altitude;

    return { theme, tempUnit, refreshInterval, altitude };
}

function persistSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.theme, settings.theme);
    localStorage.setItem(STORAGE_KEYS.tempUnit, settings.tempUnit);
    localStorage.setItem(STORAGE_KEYS.refreshInterval, String(settings.refreshInterval));
    localStorage.setItem(STORAGE_KEYS.altitude, String(settings.altitude));

    window.dispatchEvent(
        new CustomEvent('settings-updated', {
            detail: settings,
        })
    );
}

function applyTheme(theme) {
    const body = document.body;
    if (!body) {
        return;
    }

    if (theme === 'light') {
        body.classList.add('light-theme');
        return;
    }

    if (theme === 'auto') {
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        body.classList.toggle('light-theme', prefersLight);
        return;
    }

    body.classList.remove('light-theme');
}

function setupEventListeners() {
    const saveBtn = document.getElementById('save-settings-btn');
    const resetBtn = document.getElementById('reset-settings-btn');
    const themeSelect = document.getElementById('theme-select');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSettings);
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', function (event) {
            applyTheme(event.target.value);
        });
    }
}

function loadSettings() {
    const settings = getStoredSettings();
    
    document.getElementById('theme-select').value = settings.theme;
    document.getElementById('temp-unit').value = settings.tempUnit;
    document.getElementById('refresh-interval').value = settings.refreshInterval;
    document.getElementById('altitude-input').value = settings.altitude;
}

function saveSettings() {
    const settings = {
        theme: document.getElementById('theme-select').value,
        tempUnit: document.getElementById('temp-unit').value,
        refreshInterval: Number(document.getElementById('refresh-interval').value),
        altitude: Number(document.getElementById('altitude-input').value),
    };

    const normalizedSettings = {
        theme: ['dark', 'light', 'auto'].includes(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
        tempUnit: ['celsius', 'fahrenheit', 'both'].includes(settings.tempUnit) ? settings.tempUnit : DEFAULT_SETTINGS.tempUnit,
        refreshInterval: Number.isFinite(settings.refreshInterval)
            ? Math.min(Math.max(settings.refreshInterval, 1), 60)
            : DEFAULT_SETTINGS.refreshInterval,
        altitude: Number.isFinite(settings.altitude)
            ? Math.min(Math.max(settings.altitude, -500), 10000)
            : DEFAULT_SETTINGS.altitude,
    };

    document.getElementById('refresh-interval').value = normalizedSettings.refreshInterval;
    document.getElementById('altitude-input').value = normalizedSettings.altitude;

    persistSettings(normalizedSettings);
    applyTheme(normalizedSettings.theme);
    
    showSuccess('Settings saved successfully!');
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        persistSettings(DEFAULT_SETTINGS);
        applyTheme(DEFAULT_SETTINGS.theme);
        
        loadSettings();
        showSuccess('Settings reset to defaults!');
    }
}

async function loadSystemInfo() {
    try {
        const response = await fetch(`${CONFIG.apiBaseUrl}/b2f/system-info`);
        
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (response.ok) {
            const data = await response.json();
            displaySystemInfo(data);
        } else {
            // Fallback to mock data if endpoint doesn't exist
            displaySystemInfo(getMockSystemInfo());
        }
    } catch (error) {
        console.error('Error loading system info:', error);
        displaySystemInfo(getMockSystemInfo());
    }
}

function getMockSystemInfo() {
    return {
        firmware_version: '1.0.0',
        last_connection: new Date().toLocaleString(),
        uptime: '15 days 4 hours',
        data_points: 21600
    };
}

function displaySystemInfo(info) {
    document.getElementById('firmware-version').textContent = info.firmware_version || 'Unknown';
    document.getElementById('last-connection').textContent = info.last_connection || 'Unknown';
    document.getElementById('uptime').textContent = info.uptime || 'Unknown';
    document.getElementById('data-points').textContent = info.data_points || '0';
}

function updateLastUpdatedTime() {
    const element = document.getElementById('last-updated');
    if (element) {
        const now = new Date();
        element.textContent = now.toLocaleTimeString();
    }
}

function showSuccess(message) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// Cleanup
window.addEventListener('beforeunload', function () {
    // Cleanup if needed
});

