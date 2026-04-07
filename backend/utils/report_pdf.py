from io import BytesIO

PDF_TABLE_MAX_ROWS = 300
PDF_CHART_MAX_POINTS = 1200


def summarize_report_rows(formatted_rows):
    if not formatted_rows:
        return {}

    def _series(key):
        return [row[key] for row in formatted_rows]

    return {
        "count": len(formatted_rows),
        "start_local": formatted_rows[0]["timestamp_local"],
        "end_local": formatted_rows[-1]["timestamp_local"],
        "temperature": {
            "min": min(_series("temperature")),
            "max": max(_series("temperature")),
            "avg": sum(_series("temperature")) / len(formatted_rows),
        },
        "humidity": {
            "min": min(_series("humidity")),
            "max": max(_series("humidity")),
            "avg": sum(_series("humidity")) / len(formatted_rows),
        },
        "pressure": {
            "min": min(_series("pressure")),
            "max": max(_series("pressure")),
            "avg": sum(_series("pressure")) / len(formatted_rows),
        },
        "gas_resistance": {
            "min": min(_series("gas_resistance")),
            "max": max(_series("gas_resistance")),
            "avg": sum(_series("gas_resistance")) / len(formatted_rows),
        },
    }


def _sample_rows_for_table(rows, max_rows=PDF_TABLE_MAX_ROWS):
    if len(rows) <= max_rows:
        return rows, False

    sampled = []
    span = len(rows) - 1
    for i in range(max_rows):
        index = round(i * span / (max_rows - 1))
        sampled.append(rows[index])

    return sampled, True


def _sample_rows_for_chart(rows, max_points=PDF_CHART_MAX_POINTS):
    if len(rows) <= max_points:
        return rows

    sampled = []
    span = len(rows) - 1
    for i in range(max_points):
        index = round(i * span / (max_points - 1))
        sampled.append(rows[index])

    return sampled


def build_weather_pdf(formatted_rows, range_label):
    summary = summarize_report_rows(formatted_rows)
    pages = []

    summary_lines = [
        f"Weather Report - {range_label}",
        f"Data: Hourly Averages",
        f"Generated: {formatted_rows[-1]['timestamp_local'] if formatted_rows else 'N/A'}",
        f"Range: {summary.get('start_local', 'N/A')} to {summary.get('end_local', 'N/A')}",
        f"Readings: {summary.get('count', 0)}",
        "",
        f"Temperature (C): avg {summary['temperature']['avg']:.2f} | min {summary['temperature']['min']:.2f} |"
            f" max {summary['temperature']['max']:.2f}",
        f"Humidity (%): avg {summary['humidity']['avg']:.2f} | min {summary['humidity']['min']:.2f} |"
            f" max {summary['humidity']['max']:.2f}",
        f"Pressure (hPa): avg {summary['pressure']['avg']:.2f} | min {summary['pressure']['min']:.2f} |"
            f" max {summary['pressure']['max']:.2f}",
        f"Gas Resistance (Ohms): avg {summary['gas_resistance']['avg']:.2f} |"
            f" min {summary['gas_resistance']['min']:.2f} | max {summary['gas_resistance']['max']:.2f}",
        "",
        "Data columns: local timestamp, temperature, humidity, pressure, gas resistance",
    ]
    pages.append(
        {
            "kind": "text",
            "lines": summary_lines,
            "font_size": 11,
            "leading": 14,
        }
    )

    pages.append(
        {
            "kind": "chart",
            "range_label": range_label,
            "rows": formatted_rows,
            "summary": summary,
        }
    )

    table_rows, is_sampled = _sample_rows_for_table(formatted_rows)

    table_header = "Timestamp Local     | Temp C | Hum % | Press hPa | Gas Ohms"
    table_separator = "-" * len(table_header)
    table_rows = [
        (f"{row['timestamp_local']:<19} | {row['temperature']:>6.2f} | {row['humidity']:>5.1f} |"
            f" {row['pressure']:>9.1f} | {row['gas_resistance']:>8.0f}")
        for row in table_rows
    ]

    if is_sampled:
        table_rows.insert(0, f"Showing sampled rows: {len(table_rows)} of {len(formatted_rows)} total")
        table_rows.insert(1, "")

    lines_per_page = 42
    for start in range(0, len(table_rows), lines_per_page):
        pages.append(
            {
                "kind": "text",
                "lines": [table_header, table_separator, *table_rows[start : start + lines_per_page]],
                "font_size": 8,
                "leading": 10,
            }
        )

    return _build_pdf_from_pages(pages)


def _hex_to_pdf_rgb(hex_color: str) -> tuple[float, float, float]:
    value = hex_color.lstrip("#")
    if len(value) != 6:
        return (0.0, 0.0, 0.0)
    red = int(value[0:2], 16) / 255.0
    green = int(value[2:4], 16) / 255.0
    blue = int(value[4:6], 16) / 255.0
    return (red, green, blue)


def _pdf_text_line(text, x, y, font_size=10):
    return f"BT /F1 {font_size} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({_escape_pdf_text(text)}) Tj ET"


def _chart_bounds(values):
    if not values:
        return 0.0, 1.0

    low = min(values)
    high = max(values)
    if low == high:
        padding = abs(low) * 0.1 or 1.0
        return low - padding, high + padding

    span = high - low
    padding = span * 0.12 or 1.0
    return low - padding, high + padding


def _chart_polyline_commands(values, plot_x, plot_y, plot_width, plot_height):
    if not values:
        return []

    min_value, max_value = _chart_bounds(values)
    value_range = max_value - min_value or 1.0
    point_count = len(values)
    x_step = 0 if point_count == 1 else plot_width / (point_count - 1)

    commands = []
    for index, value in enumerate(values):
        x = plot_x + (index * x_step if point_count > 1 else plot_width / 2)
        normalized = (value - min_value) / value_range
        y = plot_y + (normalized * plot_height)
        commands.append((x, y))
    return commands


def _build_chart_page_stream(page):
    rows = page.get("rows", [])
    summary = page.get("summary", {})
    rows = _sample_rows_for_chart(rows)
    if not rows:
        return _pdf_page_stream(["Weather Report Charts", "No chart data available."], font_size=11, leading=14)

    width, height = 792, 612
    left_margin = 36
    right_margin = 36
    top_margin = 30
    bottom_margin = 30
    panel_gap = 10
    title_space = 32
    panel_height = (height - top_margin - bottom_margin - title_space - (panel_gap * 3)) / 4
    panel_width = width - left_margin - right_margin
    plot_left = left_margin + 96
    plot_right = width - right_margin - 18
    plot_width = plot_right - plot_left

    charts = [
        {"title": "Temperature (C)", "key": "temperature", "color": "#0ea5e9"},
        {"title": "Humidity (%)", "key": "humidity", "color": "#10b981"},
        {"title": "Pressure (hPa)", "key": "pressure", "color": "#f59e0b"},
        {"title": "Gas Resistance (Ohms)", "key": "gas_resistance", "color": "#f43f5e"},
    ]

    page_title = f"Weather Charts - {page.get('range_label', 'Selected range')}"
    page_lines = [
        "q",
        # Title text (light color for dark background)
        "0.85 0.85 0.90 rg",
        _pdf_text_line(page_title, left_margin, height - 20, font_size=13),
        _pdf_text_line(
            f"Readings: {summary.get('count', len(rows))}    Range: {summary.get('start_local', 'N/A')} to"
                f" {summary.get('end_local', 'N/A')}",
            left_margin,
            height - 36,
            font_size=8,
        ),
    ]

    # Page background
    page_lines.insert(0, f"0.10 0.12 0.16 rg 0 0 {width} {height} re f")

    for chart_index, chart in enumerate(charts):
        panel_top = height - top_margin - title_space - (chart_index * (panel_height + panel_gap))
        panel_bottom = panel_top - panel_height
        plot_bottom = panel_bottom + 18
        plot_height = panel_height - 34
        values = [float(row[chart["key"]]) for row in rows]
        min_value, max_value = _chart_bounds(values)
        color_r, color_g, color_b = _hex_to_pdf_rgb(chart["color"])

        page_lines.extend(
            [
                f"0.15 0.17 0.23 rg {left_margin:.2f} {panel_bottom:.2f} {panel_width:.2f} {panel_height:.2f} re f",
                f"0.30 0.37 0.48 RG 0.8 w {left_margin:.2f} {panel_bottom:.2f} "
                    f"{panel_width:.2f} {panel_height:.2f} re S",
                # Light text for chart title
                "0.85 0.85 0.90 rg",
                _pdf_text_line(chart["title"], left_margin + 10, panel_top - 16, font_size=11),
                # Light text for min/max
                "0.70 0.72 0.75 rg",
                _pdf_text_line(f"Max: {max_value:.2f}", left_margin + 10, panel_bottom + 8, font_size=7),
                _pdf_text_line(f"Min: {min_value:.2f}", plot_right - 70, panel_bottom + 8, font_size=7),
                f"0.30 0.37 0.48 RG 0.5 w {plot_left:.2f} {plot_bottom:.2f} m {plot_right:.2f} {plot_bottom:.2f} l S",
                f"0.30 0.37 0.48 RG 0.5 w {plot_left:.2f} {plot_bottom:.2f} m {plot_left:.2f} "
                    f"{plot_bottom + plot_height:.2f} l S",
            ]
        )

        for fraction in (0.25, 0.5, 0.75):
            y = plot_bottom + (plot_height * fraction)
            page_lines.append(f"0.25 0.32 0.42 RG 0.4 w {plot_left:.2f} {y:.2f} m {plot_right:.2f} {y:.2f} l S")

        points = _chart_polyline_commands(values, plot_left, plot_bottom, plot_width, plot_height)
        if points:
            page_lines.extend(["q", f"{color_r:.3f} {color_g:.3f} {color_b:.3f} RG", "1.8 w"])
            x0, y0 = points[0]
            page_lines.append(f"{x0:.2f} {y0:.2f} m")
            for x, y in points[1:]:
                page_lines.append(f"{x:.2f} {y:.2f} l")
            page_lines.append("S")
            page_lines.append("Q")

            for x, y in points:
                page_lines.append(f"{color_r:.3f} {color_g:.3f} {color_b:.3f} rg {x - 1.4:.2f} "
                                    f"{y - 1.4:.2f} 2.8 2.8 re f")

    page_lines.append("Q")
    return "\n".join(page_lines).encode("latin-1", errors="ignore")


def _escape_pdf_text(text):
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_page_stream(lines, width=792, height=612, font_size=10, leading=12, left_margin=36, top_margin=48):
    # Start with dark background
    commands = [
        # Page background (dark slate)
        "0.10 0.12 0.16 rg 0 0 792 612 re f",
        # Text color to light
        "0.85 0.85 0.90 rg",
        # Text positioning
        "BT", f"/F1 {font_size} Tf", f"{leading} TL", f"{left_margin} {height - top_margin} Td"
    ]
    for index, line in enumerate(lines):
        if index > 0:
            commands.append("T*")
        commands.append(f"({_escape_pdf_text(line)}) Tj")
    commands.append("ET")
    return "\n".join(commands).encode("latin-1", errors="ignore")


def _build_pdf_from_pages(pages):
    width, height = 792, 612
    objects = []

    objects.append("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj")

    first_page_object = 4
    page_object_numbers = [first_page_object + (index * 2) + 1 for index in range(len(pages))]
    kids = " ".join(f"{page_num} 0 R" for page_num in page_object_numbers)
    objects.append(f"2 0 obj << /Type /Pages /Kids [{kids}] /Count {len(pages)} >> endobj")

    objects.append("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj")

    for index, page in enumerate(pages):
        content_number = first_page_object + (index * 2)
        page_number = content_number + 1
        if isinstance(page, dict):
            kind = page.get("kind", "text")
            if kind == "chart":
                content_stream = _build_chart_page_stream(page)
            else:
                content_stream = _pdf_page_stream(
                    page.get("lines", []),
                    width=width,
                    height=height,
                    font_size=page.get("font_size", 11 if index == 0 else 8),
                    leading=page.get("leading", 14 if index == 0 else 10),
                )
        else:
            lines = page if isinstance(page, list) else []
            font_size = 11 if index == 0 else 8
            leading = 14 if index == 0 else 10
            content_stream = _pdf_page_stream(lines, width=width, height=height, font_size=font_size, leading=leading)
        objects.append(
            f"{content_number} 0 obj << /Length {len(content_stream)} >> stream\n"
            f"{content_stream.decode('latin-1')}\nendstream endobj"
        )
        objects.append(
            f"{page_number} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_number} 0 R >> endobj"
        )

    pdf_parts = [b"%PDF-1.4\n"]
    offsets = [0]

    for obj in objects:
        offsets.append(sum(len(part) for part in pdf_parts))
        pdf_parts.append(obj.encode("latin-1") + b"\n")

    xref_offset = sum(len(part) for part in pdf_parts)
    xref_lines = [f"xref\n0 {len(offsets)}\n", "0000000000 65535 f \n"]
    for offset in offsets[1:]:
        xref_lines.append(f"{offset:010d} 00000 n \n")

    trailer = (
        f"trailer << /Size {len(offsets)} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )

    pdf_bytes = b"".join(pdf_parts) + "".join(xref_lines).encode("latin-1") + trailer.encode("latin-1")
    buffer = BytesIO(pdf_bytes)
    buffer.seek(0)
    return buffer


