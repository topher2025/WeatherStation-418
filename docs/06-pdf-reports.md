# PDF Report Generation Documentation

The Weather Station can generate professional PDF reports with charts and data tables. This document explains how it works.

## Overview

The PDF generation happens in `backend/utils/report_pdf.py`. Instead of using a heavy library like ReportLab, the code generates raw PDF instructions - this makes it lightweight and self-contained.

## What is a PDF?

A PDF (Portable Document Format) is a file format that looks the same on any device. Under the hood, it's:
- A text file with special commands
- Commands like: "Draw this line", "Write this text", "Set this color"
- Binary data mixed with readable text

## File Structure

The PDF generation has these main functions:

## 1. Data Summarization: `summarize_report_rows()`

```python
def summarize_report_rows(formatted_rows):
    # Takes a list of weather readings
    # Returns min, max, and average for each measurement
```

**Input:**
```python
[
    {"temperature": 22.5, "humidity": 45.2, "pressure": 1013.25, ...},
    {"temperature": 22.6, "humidity": 45.1, "pressure": 1013.24, ...},
    {"temperature": 22.3, "humidity": 45.5, "pressure": 1013.30, ...},
]
```

**Output:**
```python
{
    "count": 3,  # Number of readings
    "start_local": "2026-04-08 15:00:00",  # First reading time
    "end_local": "2026-04-08 15:10:00",    # Last reading time
    "temperature": {
        "min": 22.3,
        "max": 22.6,
        "avg": 22.47
    },
    "humidity": {
        "min": 45.1,
        "max": 45.5,
        "avg": 45.27
    },
    # ... same for pressure and gas ...
}
```

**How it works:**
```python
def _series(key):
    return [row[key] for row in formatted_rows]
    # Extract all temperature values: [22.5, 22.6, 22.3]

{
    "count": len(formatted_rows),           # 3
    "temperature": {
        "min": min(_series("temperature")), # min([22.5, 22.6, 22.3]) = 22.3
        "max": max(_series("temperature")), # max([22.5, 22.6, 22.3]) = 22.6
        "avg": sum(...) / len(...),         # (22.5+22.6+22.3)/3 = 22.47
    }
}
```

## 2. Data Sampling for Tables: `_sample_rows_for_table()`

```python
def _sample_rows_for_table(rows, max_rows=PDF_TABLE_MAX_ROWS):
    # If we have more than 300 rows of data,
    # sample every Nth row to fit on PDF pages
    # Otherwise return all rows
```

**Why sampling?**
- A PDF page can hold ~42 lines of text
- For 7 days of data at 5-minute intervals: ~2,000 readings
- That's ~48 pages of data - too much!
- Solution: Show every 5th reading instead

**Example:**
- Original: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] (10 rows)
- Sample to 5: [1, 3, 5, 7, 10] (show every ~2 rows)

**Code:**
```python
span = len(rows) - 1                           # 9 (0 to 9)
for i in range(max_rows):                     # For 5 samples
    index = round(i * span / (max_rows - 1))  # Calculate index
    sampled.append(rows[index])
    # i=0: index = 0*9/(5-1) = 0   → rows[0]
    # i=1: index = 1*9/4 = 2.25   → rows[2]
    # i=2: index = 2*9/4 = 4.5    → rows[4]
    # i=3: index = 3*9/4 = 6.75   → rows[7]
    # i=4: index = 4*9/4 = 9      → rows[9]
```

## 3. Data Sampling for Charts: `_sample_rows_for_chart()`

Similar to table sampling but for chart data (max 1,200 points to avoid large PDFs).

## 4. Building the Report: `build_weather_pdf()`

This is the main function that orchestrates everything:

```python
def build_weather_pdf(formatted_rows, range_label):
    # formatted_rows = list of readings
    # range_label = "Last 24 hours" or "All time"
    
    summary = summarize_report_rows(formatted_rows)  # Get stats
    pages = []
    
    # Page 1: Text summary
    # Page 2: Charts (4 graphs)
    # Pages 3+: Data table
    
    return _build_pdf_from_pages(pages)  # Combine into PDF
```

## 5. PDF Rendering

### Text Pages: `_pdf_page_stream()`

```python
def _pdf_page_stream(lines, width=792, height=612, font_size=10, leading=12):
    # Creates PDF commands to render text
```

**PDF Coordinates:**
- Origin (0, 0) is at bottom-left
- Width = 792 points (8.5 inches)
- Height = 612 points (11 inches)
- 1 point = 1/72 inch

**PDF Commands (content stream):**
```
0.10 0.12 0.16 rg          # Set color to RGB (dark gray for dark background)
0 0 792 612 re f            # Draw rectangle from (0,0) to (792,612) and fill
0.85 0.85 0.90 rg           # Set text color to light gray
BT                          # Begin text
/F1 11 Tf                   # Set font and size
14 TL                       # Set line height (leading)
36 564 Td                   # Move to position (36, 564)
(Weather Report - All Time) Tj  # Write text
T*                          # New line
ET                          # End text
```

**What these commands mean:**

| Command | Purpose |
|---------|---------|
| `rg` | Set RGB color (0-1 for each component) |
| `re` | Rectangle |
| `f` | Fill (solid color) |
| `BT/ET` | Begin/End text block |
| `Tf` | Set text font and size |
| `TL` | Set text leading (line spacing) |
| `Td` | Move text position |
| `Tj` | Write text string |
| `T*` | New line (same as line height) |

### Chart Pages: `_build_chart_page_stream()`

This creates 4 charts on one page:

```
┌─────────────────────────────────┐
│  Weather Charts - Last 24 hours │
├─────────────────────────────────┤
│  Temperature (°C)               │  ← Chart 1
│  [Line graph showing temp]      │
├─────────────────────────────────┤
│  Humidity (%)                   │  ← Chart 2
│  [Line graph showing humidity]  │
├─────────────────────────────────┤
│  Pressure (hPa)                 │  ← Chart 3
│  [Line graph showing pressure]  │
├─────────────────────────────────┤
│  Gas Resistance (Ohms)          │  ← Chart 4
│  [Line graph showing gas]       │
└─────────────────────────────────┘
```

**Chart Layout:**
- Page dimensions: 792 × 612 points
- 4 charts stacked vertically
- Each chart has: title, axes, gridlines, line graph, data points

**Creating a Line Chart:**

```python
def _chart_polyline_commands(values, plot_x, plot_y, plot_width, plot_height):
    # Convert data values to (x, y) coordinates on the PDF
    
    min_value, max_value = _chart_bounds(values)  # Find data range
    value_range = max_value - min_value
    
    # For each data point, calculate its position
    for index, value in enumerate(values):
        x = plot_x + (index * x_step)  # Spread across width
        normalized = (value - min_value) / value_range  # 0 to 1
        y = plot_y + (normalized * plot_height)  # Scale to height
        commands.append((x, y))
    
    return commands
```

**Example:**
```
Values: [20, 22, 25, 23, 21]
Range: 20 to 25
Normalized: [0, 0.4, 1, 0.6, 0.2]

Plot area: x=100 to 200 (width=100), y=50 to 150 (height=100)
Points:
  x=100, y=50    (20 → 0% of height)
  x=120, y=90    (22 → 40% of height)
  x=140, y=150   (25 → 100% of height)
  x=160, y=110   (23 → 60% of height)
  x=180, y=70    (21 → 20% of height)
```

Then the code draws a line connecting these points.

## 6. PDF Assembly: `_build_pdf_from_pages()`

This assembles multiple pages into a complete PDF file:

```python
def _build_pdf_from_pages(pages):
    objects = []
    
    # PDF Header
    objects.append("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj")
    
    # Pages directory
    objects.append("2 0 obj << /Type /Pages /Kids [page refs] ... >> endobj")
    
    # Font definition
    objects.append("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj")
    
    # Content streams for each page
    for page in pages:
        objects.append(f"{n} 0 obj << /Length {size} >> stream ... endstream endobj")
        objects.append(f"{m} 0 obj << /Type /Page ... /Contents {n} ... >> endobj")
    
    # Cross-reference table (index of all objects)
    # Trailer (point to root object)
    
    return buffer
```

**PDF Structure:**
```
%PDF-1.4                           ← PDF version header
1 0 obj << ... >> endobj           ← Object 1: Catalog (root)
2 0 obj << ... >> endobj           ← Object 2: Pages (list of pages)
3 0 obj << ... >> endobj           ← Object 3: Font definition
4 0 obj << ... >> stream ... >> obj ← Object 4: Page 1 content
5 0 obj << ... >> endobj           ← Object 5: Page 1 definition
6 0 obj << ... >> stream ... >> obj ← Object 6: Page 2 content
7 0 obj << ... >> endobj           ← Object 7: Page 2 definition
...
xref                               ← Cross-reference table
0 10
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
...
trailer << /Size 10 /Root 1 0 R >>
startxref
5000
%%EOF
```

## 7. Helper Functions

### `_hex_to_pdf_rgb(hex_color: str)`

```python
def _hex_to_pdf_rgb(hex_color: str) -> tuple[float, float, float]:
    # Convert "#3498db" to (0.204, 0.596, 0.859)
    
    value = hex_color.lstrip("#")        # "3498db"
    red = int(value[0:2], 16) / 255.0    # 52 / 255 = 0.204
    green = int(value[2:4], 16) / 255.0  # 148 / 255 = 0.580
    blue = int(value[4:6], 16) / 255.0   # 219 / 255 = 0.859
```

**Why divide by 255?**
- Hex colors use 0-255 range
- PDF uses 0-1 range
- 255/255 = 1.0, 128/255 = 0.502, etc.

### `_escape_pdf_text(text)`

```python
def _escape_pdf_text(text):
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    # Escapes special characters in PDF strings
    # "Hello (World)" → "Hello \\(World\\)"
```

### `_chart_bounds(values)`

```python
def _chart_bounds(values):
    # Find minimum and maximum with padding
    low = min(values)
    high = max(values)
    span = high - low
    padding = span * 0.12 or 1.0  # 12% padding or minimum 1
    return low - padding, high + padding
```

**Why padding?**
- Makes chart look less cramped
- Data touches edges without looking crowded

## Color Scheme

The PDF uses a dark theme:

```python
# Background colors
"0.10 0.12 0.16 rg"  # Very dark gray (RGB: 26, 31, 41)
"0.15 0.17 0.23 rg"  # Dark gray for panels

# Border/axis colors
"0.30 0.37 0.48 RG"  # Medium gray for borders

# Text colors
"0.85 0.85 0.90 rg"  # Light text
"0.70 0.72 0.75 rg"  # Dimmer text for labels

# Chart colors
"#0ea5e9" (Sky blue)      → Temperature
"#10b981" (Green)         → Humidity
"#f59e0b" (Orange)        → Pressure
"#f43f5e" (Rose red)      → Gas
```

## Data Formatting

The PDF displays data in a formatted table:

```
Timestamp Local    | Temp C | Hum % | Press hPa | Gas Ohms
2026-04-08 15:00   |  22.50 |  45.2 |    1013.3 |    14950
2026-04-08 16:00   |  23.10 |  44.8 |    1013.2 |    15100
2026-04-08 17:00   |  22.75 |  45.5 |    1013.4 |    14800
```

**Format specifiers:**
- `timestamp_local:<19` - Left-align in 19 characters
- `temperature:>6.2f` - Right-align, 6 chars total, 2 decimal places
- `humidity:>5.1f` - Right-align, 5 chars, 1 decimal place

## Performance

**Optimization techniques:**
1. **Sampling** - Reduce data points for large date ranges
2. **Streaming** - Generate PDF without loading entire file in memory
3. **BytesIO** - Keep PDF in memory instead of writing to disk
4. **Efficient PDF** - No compression, just raw instructions

**Typical sizes:**
- 24 hours of data: ~50 KB PDF
- 7 days of data: ~150 KB PDF
- 30 days of data: ~300 KB PDF
- 1 year of data: ~1 MB PDF

## Error Handling

```python
try:
    pdf_buffer = build_weather_pdf(formatted_rows, "Last 24 hours")
except Exception as e:
    return jsonify(error="Failed to generate PDF"), 500
```

Common issues:
- Empty data → "No historical data available"
- Invalid dates → DateTime parsing error
- Memory → Large PDFs might not fit in memory

## Customization

### Changing Colors

In `_build_chart_page_stream()`:

```python
charts = [
    {"title": "Temperature (C)", "key": "temperature", "color": "#0ea5e9"},  # ← Change color
    {"title": "Humidity (%)", "key": "humidity", "color": "#10b981"},
    ...
]
```

### Changing Layout

```python
panel_height = (height - top_margin - bottom_margin - title_space - (panel_gap * 3)) / 4
# Change 4 to 2 for 2 charts per page instead of 4
```

### Changing Font

```python
objects.append("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj")
# Change /Courier to /Times-Roman or /Helvetica
```

## Tips for Developers

1. **Test with small data** - Use last 24 hours first
2. **Check PDF in reader** - Open in Acrobat to verify
3. **Monitor memory** - Large datasets might use lots of RAM
4. **Use BytesIO** - Send PDF without saving to disk
5. **Add logging** - Track how long PDF generation takes

## Future Enhancements

1. **Compression** - Compress PDF stream to reduce size
2. **Multiple report styles** - Alternative layouts
3. **Custom ranges** - User selects date range
4. **Statistics** - Add more statistics to summary page
5. **Alerts** - Mark out-of-range readings on charts
6. **Comparison** - Compare two time periods side-by-side

