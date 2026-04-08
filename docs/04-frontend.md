# Frontend Documentation

The frontend is what users see and interact with. It's a web-based dashboard built with HTML, CSS, and JavaScript.

## What is the Frontend?

The frontend is the visual interface running in your web browser. It:
- Displays weather information
- Allows login/logout
- Lets users download reports
- Shows system logs
- Updates automatically every few seconds

## Architecture

The frontend uses a simple architecture:

```
1. HTML Files (Structure)
   └── index.html, data.html, history.html, etc.

2. CSS File (Styling)
   └── static/styles.css

3. JavaScript Files (Behavior)
   └── static/index.js, data.js, history.js, etc.

4. Templates
   └── base.html (shared layout)
```

## File Structure

### HTML Files

#### `base.html` - Master Template
The base template that other pages extend. Contains:
- Navigation bar (top menu)
- Main content area (where page content goes)
- Footer (bottom info)
- Shared scripts

**Structure:**
```html
<nav>           <!-- Navigation bar -->
<main>          <!-- Page content (filled by each page) -->
<footer>        <!-- Footer -->
<script>        <!-- Shared JavaScript -->
```

#### `index.html` - Dashboard (Main Page)
Shows current weather and 24-hour trends.

**Components:**
1. **Current Weather Card** - Large display of current temperature, humidity, pressure, gas
2. **Trends Card** - Min/max/avg for last 24 hours
3. **Statistics Card** - High/low temperatures, average humidity
4. **System Card** - Connection status

#### `data.html` - Data Download
Lets users download weather reports as CSV or PDF.

#### `history.html` - Historical Data
Shows past weather readings in a table or timeline.

#### `settings.html` - User Preferences
Allows users to change:
- Theme (dark/light/auto)
- Temperature unit (Celsius/Fahrenheit/Both)
- Refresh interval

#### `login.html` - Login Page
Shows username/password form with security features.

#### `logs.html` - System Logs
Displays the last N lines of the application log file.

## Main JavaScript File: `frontend/static/index.js`

This is the brain of the dashboard. Let's break it down.

### 01. Configuration

```javascript
const CONFIG = {
    apiBaseUrl: '/api',           // Where to find the backend API
    updateInterval: 5000,         // Update every 5 seconds
    chartUpdateInterval: 5000,    // Refresh charts every 5 seconds
};

const DEFAULT_SETTINGS = {
    theme: 'dark',                // Default to dark theme
    tempUnit: 'celsius',          // Default to Celsius
    refreshInterval: 5,           // Refresh every 5 seconds
};
```

### 02. State Variables

```javascript
let currentWeatherData = null;    // Stores latest weather reading
let historicalData = null;        // Stores past readings for charts
let autoUpdateInterval = null;    // Timer for auto-refresh
let chartUpdateInterval = null;   // Timer for chart refresh
let settings = { ...DEFAULT_SETTINGS };  // User preferences
```

**State** = Data stored in memory while the page is open.

### 03. Initialization

```javascript
document.addEventListener('DOMContentLoaded', function () {
    initializeDashboard();
});
```

**What is DOMContentLoaded?**
- Fires when the HTML page has fully loaded
- Everything is ready, now we can start JavaScript code
- This is when we fetch initial data and set up timers

### 04. Main Functions

#### `initializeDashboard()`
Runs when the page loads. Sets up everything:

```javascript
function initializeDashboard() {
    settings = loadSettings();           // Load user preferences
    applyTheme(settings.theme);          // Apply dark/light theme
    fetchCurrentWeather();               // Get latest weather
    fetchHistoricalData();               // Get past readings
    configureAutoRefresh(settings.refreshInterval);  // Start auto-update
    updateLastUpdatedTime();             // Show when data was updated
}
```

#### `loadSettings()`
Loads user preferences from browser storage (localStorage):

```javascript
function loadSettings() {
    const storedTheme = localStorage.getItem('theme') || DEFAULT_SETTINGS.theme;
    // If user saved 'dark', use 'dark'
    // Otherwise use DEFAULT_SETTINGS.theme which is 'dark'
    
    return {
        theme: storedTheme,
        tempUnit: stored value or default,
        refreshInterval: stored value or default
    };
}
```

**What is localStorage?**
- Browser storage on your computer
- Data persists even if you close the browser
- Perfect for saving user preferences
- Limited to ~5-10 MB per website

#### `applyTheme(theme)`
```javascript
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');  // Add light CSS class
    } else if (theme === 'auto') {
        // Check system preference (does Windows prefer light or dark?)
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        document.body.classList.toggle('light-theme', prefersLight);
    }
    // Otherwise keep dark theme (default)
}
```

**How themes work:**
1. JavaScript adds a CSS class to the `<body>` tag
2. CSS rules check for that class
3. CSS applies different colors based on the class

```css
/* Dark theme (default) */
body {
    background-color: #1a1a1a;
    color: #ffffff;
}

/* Light theme */
body.light-theme {
    background-color: #ffffff;
    color: #000000;
}
```

#### `fetchCurrentWeather()`
```javascript
function fetchCurrentWeather() {
    // Makes an HTTP request to /api/b2f/update
    // Gets the latest weather reading
    // Updates the dashboard display
}
```

**Network request:**
```text
Browser                                   Backend Server
  |                                              |
  |  GET /api/b2f/update  ---------------------->|
  |                                              |
  |<---------------  {"temperature": 22.5, ...}  |
  | Display the data                             |
```

#### `fetchHistoricalData()`
```javascript
function fetchHistoricalData() {
    // Fetches hourly data for the past 24 hours
    // Used to show trends and charts
    // Calls /api/b2f/hourly?hours=24
}
```

#### `configureAutoRefresh(refreshSeconds)`
```javascript
function configureAutoRefresh(refreshSeconds) {
    // If user wants 5-second refresh:
    autoUpdateInterval = setInterval(fetchCurrentWeather, 5000);
    chartUpdateInterval = setInterval(fetchHistoricalData, 5000);
    
    // setInterval = "run this function every 5000 milliseconds"
    // This creates automatic updates without user clicking anything
}
```

### 05. Temperature Conversion

```javascript
function cToF(value) {
    return (value * 9) / 5 + 32;
}
```

**Formula:** °F = (°C × 9/5) + 32

Example: 22°C = (22 × 1.8) + 32 = 71.6°F

### 06. Updating the Display

```javascript
function updateTemperatureDisplay(value) {
    const element = document.getElementById('current-temp');
    element.textContent = value.toFixed(1);  // Show 1 decimal place
}
```

**How it works:**
1. Get HTML element with `getElementById()`
2. Update its text content
3. Browser automatically re-renders on screen

### 07. Error Handling

```javascript
function handleApiError(error, fallbackMessage) {
    console.error(error);
    // Log error to browser console
    // Show fallback message to user
    // Let dashboard still work with old data
}
```

**Graceful degradation:**
- If the API fails, don't crash the page
- Show an error message
- Keep displaying the last known data
- Try again in a few seconds

## Other JavaScript Files

### `logout.js` - Logout Handler
```javascript
function handleLogout() {
    // When user clicks "Logout"
    // Send request to /logout endpoint
    // Clear session
    // Redirect to login page
}
```

### `data.js` - Data Download Page
```javascript
function downloadCSV() {
    // Fetch /api/b2f/report.csv
    // Browser shows "Save As" dialog
    // Downloads a CSV file
}

function downloadPDF() {
    // Fetch /api/b2f/report.pdf
    // Browser shows "Save As" dialog
    // Downloads a PDF file
}
```

### `history.js` - Historical Data Page
```javascript
function displayHistoricalData() {
    // Fetch data from /api/b2f/hourly
    // Display in a table
    // Maybe show a chart
}
```

### `settings.js` - Settings Page
```javascript
function saveTheme(theme) {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    // Reload to apply new theme
}

function saveTempUnit(unit) {
    localStorage.setItem('tempUnit', unit);
    // Refresh display with new unit
}
```

### `logs.js` - Logs Page
```javascript
function fetchAndDisplayLogs(lineCount) {
    // Fetch /api/b2f/logs?lines=200
    // Display last N lines
    // Auto-scroll to bottom
}
```

## CSS Styling: `frontend/static/styles.css`

The CSS file controls how everything looks. Key concepts:

### 01. CSS Variables (Custom Properties)

```css
:root {
    --primary-color: #3498db;     /* Blue accent */
    --background-dark: #1a1a1a;   /* Very dark background */
    --text-light: #ffffff;         /* White text */
    --card-background: #2a2a2a;   /* Card background */
}
```

**Why use variables?**
- Change one place, affects entire site
- Easier for dark/light themes
- Better organization

### 02. Layout

The site uses **CSS Flexbox** for layout:

```css
.dashboard {
    display: flex;
    flex-wrap: wrap;        /* Cards wrap to next line */
    gap: 20px;             /* Space between cards */
}

.card {
    flex: 1;               /* Cards grow to fill space */
    min-width: 250px;      /* But not smaller than 250px */
    background: var(--card-background);
    padding: 20px;
    border-radius: 8px;    /* Rounded corners */
}
```

**Flexbox = simple responsive layout**
- On desktop: cards in a row
- On mobile: cards stack vertically

### 03. Grid Layout

Inside cards, data uses **CSS Grid**:

```css
.weather-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;  /* 2 columns */
    gap: 15px;
    margin-top: 15px;
}
```

**Grid = table-like layout** but more flexible

### 04. Responsive Design

```css
@media (max-width: 768px) {
    /* Mobile screens */
    .weather-grid {
        grid-template-columns: 1fr;  /* 1 column on mobile */
    }
}
```

**Media queries = different styles for different screen sizes**
- Desktop gets 2 columns
- Mobile gets 1 column
- Automatically adjusts

### 05. Animations

```css
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.card {
    animation: fadeIn 0.3s ease-in;  /* Fade in when loaded */
}
```

## How Frontend & Backend Communicate

### Request/Response Cycle

```javascript
// Frontend makes a request
fetch('/api/b2f/update')
    .then(response => response.json())    // Parse JSON response
    .then(data => {
        console.log(data);  // Use the data
    })
    .catch(error => {
        console.error('Error:', error);   // Handle error
    });

// This sends:
// GET /api/b2f/update
// 
// Backend responds:
// {
//     "id": 100,
//     "timestamp": "2026-04-08 15:30:00",
//     "temperature": 22.5,
//     "humidity": 45.2,
//     ...
// }
```

### Authentication

Every API request includes session cookie:

```javascript
// Browser automatically includes cookies
fetch('/api/b2f/update')
// Sends header: Cookie: session=abc123xyz...
// Backend checks: Is this session valid?
// If yes, return data
// If no, return 401 Unauthorized
```

## Performance Tips

1. **Debouncing** - Don't update display too often
2. **Caching** - Store data in variables to avoid duplicate requests
3. **Lazy loading** - Only load images/data when needed
4. **Minification** - Compress JavaScript and CSS
5. **CDN** - Serve static files from fast server

## Debugging

Open browser Developer Tools (F12):

### Console Tab
```javascript
// Check current weather data
console.log(currentWeatherData);

// Test fetching data
fetch('/api/b2f/update').then(r => r.json()).then(d => console.log(d));
```

### Network Tab
- See all HTTP requests
- Check response status (200, 401, 500, etc.)
- View response data
- Check request headers

### Elements Tab
- Inspect HTML structure
- See what CSS is applied
- Check for layout issues

## Common Tasks

### Adding a New Widget
1. Create HTML element in the appropriate `.html` file
2. Give it an ID: `<div id="my-widget">`
3. Add JavaScript to populate it:
   ```javascript
   function updateMyWidget(data) {
       document.getElementById('my-widget').textContent = data.value;
   }
   ```
4. Call `updateMyWidget()` when data arrives
5. Add CSS styling in `styles.css`

### Changing Update Frequency
Edit `DEFAULT_SETTINGS.refreshInterval` or let users change it in settings.

### Adding Dark Mode Toggle
Already built in! Settings page has theme selector.

### Displaying Charts
The PDF reports include charts. For web charts, you'd add a library like Chart.js:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

## Accessibility

Good practices already in place:
- Semantic HTML (`<nav>`, `<main>`, `<footer>`)
- Color contrast for readability
- Responsive design works on mobile
- No JavaScript required for basic structure

## Browser Compatibility

The code uses modern JavaScript (ES6):
- Works in Chrome, Firefox, Safari, Edge
- May not work in Internet Explorer (intentional)
- Uses fetch API (not old XMLHttpRequest)

## Future Enhancements

- Add real-time charts (Chart.js or D3.js)
- Export data to various formats
- Compare time periods
- Alert thresholds (notify if temp goes outside range)
- Mobile app wrapper (Cordova/React Native)

