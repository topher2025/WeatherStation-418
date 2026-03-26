// ========== Settings Page JavaScript ==========

const CONFIG = {
    apiBaseUrl: '/api',
};

// Initialization
document.addEventListener('DOMContentLoaded', function () {
    loadSettings();
    loadSystemInfo();
    setupEventListeners();
    updateLastUpdatedTime();
    setInterval(updateLastUpdatedTime, 60000);
});

function setupEventListeners() {
    const saveBtn = document.getElementById('save-settings-btn');
    const resetBtn = document.getElementById('reset-settings-btn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSettings);
    }
}

function loadSettings() {
    // Load from localStorage
    const theme = localStorage.getItem('theme') || 'dark';
    const tempUnit = localStorage.getItem('tempUnit') || 'celsius';
    const refreshInterval = localStorage.getItem('refreshInterval') || '5';
    const altitude = localStorage.getItem('altitude') || '0';
    
    document.getElementById('theme-select').value = theme;
    document.getElementById('temp-unit').value = tempUnit;
    document.getElementById('refresh-interval').value = refreshInterval;
    document.getElementById('altitude-input').value = altitude;
}

function saveSettings() {
    const theme = document.getElementById('theme-select').value;
    const tempUnit = document.getElementById('temp-unit').value;
    const refreshInterval = document.getElementById('refresh-interval').value;
    const altitude = document.getElementById('altitude-input').value;
    
    localStorage.setItem('theme', theme);
    localStorage.setItem('tempUnit', tempUnit);
    localStorage.setItem('refreshInterval', refreshInterval);
    localStorage.setItem('altitude', altitude);
    
    showSuccess('Settings saved successfully!');
}

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
        localStorage.removeItem('theme');
        localStorage.removeItem('tempUnit');
        localStorage.removeItem('refreshInterval');
        localStorage.removeItem('altitude');
        
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

